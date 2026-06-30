const { desktopCapturer, screen } = require('electron');
const logger = require('../core/logger').createServiceLogger('CAPTURE');

class CaptureService {
  constructor() {
    this.isProcessing = false;
  }

  listDisplays() {
    try {
      const displays = screen.getAllDisplays().map(d => ({
        id: d.id,
        bounds: d.bounds,
        size: d.size,
        scaleFactor: d.scaleFactor,
        rotation: d.rotation,
        touchSupport: d.touchSupport || 'unknown'
      }));
      return { success: true, displays };
    } catch (error) {
      logger.error('Failed to list displays', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Capture screenshot and return an image buffer.
   * options: { displayId?: number, area?: { x, y, width, height } }
   */
  async captureAndProcess(options = {}) {
    if (this.isProcessing) throw new Error('Capture already in progress');
    this.isProcessing = true;
    const startTime = Date.now();
    try {
      const { image, metadata } = await this.captureScreenshot(options);

      // Crop if area specified
      let finalImage = image;
      if (options.area && this._isValidArea(options.area)) {
        try {
          finalImage = image.crop(options.area);
        } catch (e) {
          logger.warn('Crop failed, returning full image', { error: e.message, area: options.area });
        }
      }

      const optimizedImage = this.optimizeForAnalysis(finalImage);
      const compressionResult = this.compressForAnalysis(optimizedImage);
      logger.logPerformance('Screenshot capture', startTime, {
        bytes: compressionResult.buffer.length,
        dimensions: optimizedImage.getSize(),
        mimeType: compressionResult.mimeType
      });

      return {
        imageBuffer: compressionResult.buffer,
        mimeType: compressionResult.mimeType,
        metadata: {
          timestamp: new Date().toISOString(),
          source: metadata,
          processingTime: Date.now() - startTime
        }
      };
    } finally {
      this.isProcessing = false;
    }
  }

  async captureScreenshot(options = {}) {
    const targetDisplay = this._getTargetDisplay(options.displayId);
    const { width, height } = targetDisplay.size || { width: 1920, height: 1080 };

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height }
    });

    if (sources.length === 0) {
      throw new Error('No screen sources available for capture');
    }

    // Find source matching the target display by comparing sizes as heuristic
    let source = sources[0];
    const match = sources.find(s => {
      const size = s.thumbnail.getSize();
      return size.width === width && size.height === height;
    });
    if (match) source = match;

    const image = source.thumbnail;
    if (!image) throw new Error('Failed to capture screen thumbnail');

    logger.debug('Screenshot captured successfully', {
      sourceName: source.name,
      imageSize: image.getSize()
    });

    return {
      image,
      metadata: {
        displayId: targetDisplay.id,
        sourceName: source.name,
        dimensions: image.getSize(),
        captureTime: new Date().toISOString()
      }
    };
  }

  optimizeForAnalysis(image) {
    try {
      const { width, height } = image.getSize();
      const maxDimension = 1280;
      const needsResize = width > maxDimension || height > maxDimension;

      if (!needsResize) {
        return image;
      }

      const scale = Math.min(1, maxDimension / Math.max(width, height));
      const resizedWidth = Math.max(720, Math.round(width * scale));
      const resizedHeight = Math.max(540, Math.round(height * scale));

      return image.resize({ width: resizedWidth, height: resizedHeight });
    } catch (error) {
      logger.warn('Failed to resize screenshot for analysis', { error: error.message });
      return image;
    }
  }

  compressForAnalysis(image) {
    try {
      const buffer = image.toJPEG(85);
      return { buffer, mimeType: 'image/jpeg' };
    } catch (error) {
      logger.warn('JPEG compression failed, falling back to PNG', { error: error.message });
      const buffer = image.toPNG();
      return { buffer, mimeType: 'image/png' };
    }
  }

  _getTargetDisplay(displayId) {
    const all = screen.getAllDisplays();
    if (!all || all.length === 0) return screen.getPrimaryDisplay();
    if (displayId == null) return screen.getPrimaryDisplay();
    const found = all.find(d => d.id === displayId);
    return found || screen.getPrimaryDisplay();
  }

  _isValidArea(area) {
    return area && Number.isFinite(area.x) && Number.isFinite(area.y) &&
      Number.isFinite(area.width) && Number.isFinite(area.height) &&
      area.width > 0 && area.height > 0;
  }
}

module.exports = new CaptureService();
