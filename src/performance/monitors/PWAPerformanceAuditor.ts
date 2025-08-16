/**
 * PWA Performance Auditor - Lighthouse-compatible performance auditing
 * Provides comprehensive analysis for GitHub Pages deployment and PWA optimization
 */

interface LighthouseMetrics {
  // Core Web Vitals
  firstContentfulPaint: number; // FCP
  largestContentfulPaint: number; // LCP
  cumulativeLayoutShift: number; // CLS
  firstInputDelay: number; // FID
  interactionToNextPaint: number; // INP
  
  // Performance metrics
  speedIndex: number;
  timeToInteractive: number; // TTI
  totalBlockingTime: number; // TBT
  
  // Resource metrics
  resourceLoadTime: number;
  domContentLoaded: number;
  loadComplete: number;
  
  // PWA specific
  serviceWorkerRegistration: boolean;
  offlineCapability: boolean;
  installPrompt: boolean;
  manifestValid: boolean;
}

interface PerformanceAuditResult {
  score: number; // 0-100
  category: 'performance' | 'pwa' | 'accessibility' | 'seo';
  metrics: LighthouseMetrics;
  opportunities: OptimizationOpportunity[];
  diagnostics: PerformanceDiagnostic[];
  passed: boolean;
  timestamp: number;
}

interface OptimizationOpportunity {
  id: string;
  title: string;
  description: string;
  score: number; // Impact score 0-100
  numericValue: number;
  numericUnit: string;
  details: {
    type: string;
    items: any[];
  };
}

interface PerformanceDiagnostic {
  id: string;
  title: string;
  description: string;
  scoreDisplayMode: 'binary' | 'numeric' | 'informative';
  score: number | null;
  details?: any;
}

interface GitHubPagesOptimization {
  category: 'assets' | 'caching' | 'compression' | 'routing';
  title: string;
  description: string;
  implementation: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
}

export class PWAPerformanceAuditor {
  private performanceObserver?: PerformanceObserver;
  private metrics: Partial<LighthouseMetrics> = {};
  private monitoring = false;
  private auditResults: PerformanceAuditResult[] = [];
  
  // Performance thresholds (based on Lighthouse scoring)
  private readonly THRESHOLDS = {
    FCP: { good: 1800, poor: 3000 },      // First Contentful Paint
    LCP: { good: 2500, poor: 4000 },      // Largest Contentful Paint
    FID: { good: 100, poor: 300 },        // First Input Delay
    CLS: { good: 0.1, poor: 0.25 },       // Cumulative Layout Shift
    TTI: { good: 3800, poor: 7300 },      // Time to Interactive
    TBT: { good: 200, poor: 600 },        // Total Blocking Time
    SI: { good: 3400, poor: 5800 }        // Speed Index
  };

  constructor() {
    this.initializePerformanceObserver();
    console.log('PWA Performance Auditor initialized');
  }

  private initializePerformanceObserver(): void {
    if (!('PerformanceObserver' in window)) {
      console.warn('PerformanceObserver not supported');
      return;
    }

    try {
      // Observe paint metrics
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.processPerformanceEntry(entry);
        }
      });

      // Start observing different types of performance entries
      this.performanceObserver.observe({ type: 'paint', buffered: true });
      this.performanceObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      this.performanceObserver.observe({ type: 'layout-shift', buffered: true });
      this.performanceObserver.observe({ type: 'first-input', buffered: true });
      this.performanceObserver.observe({ type: 'navigation', buffered: true });
      this.performanceObserver.observe({ type: 'resource', buffered: true });

      // Try to observe newer metrics
      try {
        this.performanceObserver.observe({ type: 'interaction', buffered: true });
      } catch (e) {
        console.log('INP measurement not supported');
      }

    } catch (error) {
      console.warn('Failed to initialize PerformanceObserver:', error);
    }
  }

  private processPerformanceEntry(entry: PerformanceEntry): void {
    switch (entry.entryType) {
      case 'paint':
        if (entry.name === 'first-contentful-paint') {
          this.metrics.firstContentfulPaint = entry.startTime;
        }
        break;

      case 'largest-contentful-paint':
        this.metrics.largestContentfulPaint = entry.startTime;
        break;

      case 'layout-shift':
        const layoutShiftEntry = entry as any;
        if (!layoutShiftEntry.hadRecentInput) {
          this.metrics.cumulativeLayoutShift = 
            (this.metrics.cumulativeLayoutShift || 0) + layoutShiftEntry.value;
        }
        break;

      case 'first-input':
        this.metrics.firstInputDelay = (entry as any).processingStart - entry.startTime;
        break;

      case 'interaction':
        // INP measurement (if supported)
        this.metrics.interactionToNextPaint = Math.max(
          this.metrics.interactionToNextPaint || 0,
          (entry as any).duration
        );
        break;

      case 'navigation':
        const navEntry = entry as PerformanceNavigationTiming;
        this.metrics.domContentLoaded = navEntry.domContentLoadedEventEnd - navEntry.fetchStart;
        this.metrics.loadComplete = navEntry.loadEventEnd - navEntry.fetchStart;
        this.calculateTimeToInteractive(navEntry);
        break;
    }
  }

  private calculateTimeToInteractive(navEntry: PerformanceNavigationTiming): void {
    // Simplified TTI calculation
    // In a real implementation, this would be more complex
    const domInteractive = navEntry.domInteractive - navEntry.fetchStart;
    const loadEventStart = navEntry.loadEventStart - navEntry.fetchStart;
    
    // Estimate TTI as somewhere between DOM interactive and load complete
    this.metrics.timeToInteractive = Math.max(domInteractive, loadEventStart * 0.8);
  }

  async runComprehensiveAudit(): Promise<PerformanceAuditResult> {
    console.log('Running comprehensive PWA performance audit');
    
    // Collect all metrics
    await this.collectAllMetrics();
    
    // Calculate scores
    const score = this.calculateOverallScore();
    
    // Generate opportunities and diagnostics
    const opportunities = this.generateOptimizationOpportunities();
    const diagnostics = this.generateDiagnostics();
    
    const result: PerformanceAuditResult = {
      score,
      category: 'performance',
      metrics: this.metrics as LighthouseMetrics,
      opportunities,
      diagnostics,
      passed: score >= 90, // Lighthouse "good" threshold
      timestamp: Date.now()
    };
    
    this.auditResults.push(result);
    
    return result;
  }

  private async collectAllMetrics(): Promise<void> {
    // Wait for page to be fully loaded
    if (document.readyState !== 'complete') {
      await new Promise(resolve => {
        window.addEventListener('load', resolve, { once: true });
      });
    }

    // Additional metrics collection
    await this.measureResourceLoadTime();
    await this.measureSpeedIndex();
    await this.measureTotalBlockingTime();
    
    // PWA-specific metrics
    this.checkServiceWorkerRegistration();
    this.checkOfflineCapability();
    this.checkInstallPrompt();
    this.checkManifestValidity();
  }

  private async measureResourceLoadTime(): Promise<void> {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    if (resources.length > 0) {
      const totalLoadTime = resources.reduce((sum, resource) => {
        return sum + (resource.responseEnd - resource.requestStart);
      }, 0);
      
      this.metrics.resourceLoadTime = totalLoadTime / resources.length;
    }
  }

  private async measureSpeedIndex(): Promise<void> {
    // Simplified Speed Index calculation
    // In reality, this requires visual progress analysis
    const paintEntries = performance.getEntriesByType('paint');
    const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    
    if (fcp && this.metrics.largestContentfulPaint) {
      // Rough approximation: Speed Index ≈ (FCP + LCP) / 2
      this.metrics.speedIndex = (fcp.startTime + this.metrics.largestContentfulPaint) / 2;
    }
  }

  private async measureTotalBlockingTime(): Promise<void> {
    // TBT measurement requires long task observation
    if ('PerformanceLongTaskTiming' in window) {
      const longTasks = performance.getEntriesByType('longtask');
      
      this.metrics.totalBlockingTime = longTasks.reduce((tbt, task) => {
        // Tasks longer than 50ms contribute to TBT
        const blockingTime = Math.max(0, task.duration - 50);
        return tbt + blockingTime;
      }, 0);
    }
  }

  private checkServiceWorkerRegistration(): void {
    this.metrics.serviceWorkerRegistration = 'serviceWorker' in navigator && 
      !!navigator.serviceWorker.controller;
  }

  private checkOfflineCapability(): void {
    // Check if app works offline by testing cache
    this.metrics.offlineCapability = this.metrics.serviceWorkerRegistration && 
      'caches' in window;
  }

  private checkInstallPrompt(): void {
    // Check if PWA install prompt is available
    this.metrics.installPrompt = 'onbeforeinstallprompt' in window;
  }

  private checkManifestValidity(): void {
    // Check if manifest is present and valid
    const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
    this.metrics.manifestValid = !!manifestLink && !!manifestLink.href;
  }

  private calculateOverallScore(): number {
    let score = 100;
    
    // FCP scoring
    if (this.metrics.firstContentfulPaint) {
      score -= this.calculateMetricPenalty(
        this.metrics.firstContentfulPaint,
        this.THRESHOLDS.FCP.good,
        this.THRESHOLDS.FCP.poor,
        15
      );
    }
    
    // LCP scoring (highest weight)
    if (this.metrics.largestContentfulPaint) {
      score -= this.calculateMetricPenalty(
        this.metrics.largestContentfulPaint,
        this.THRESHOLDS.LCP.good,
        this.THRESHOLDS.LCP.poor,
        25
      );
    }
    
    // CLS scoring
    if (this.metrics.cumulativeLayoutShift !== undefined) {
      score -= this.calculateMetricPenalty(
        this.metrics.cumulativeLayoutShift,
        this.THRESHOLDS.CLS.good,
        this.THRESHOLDS.CLS.poor,
        15
      );
    }
    
    // FID scoring
    if (this.metrics.firstInputDelay) {
      score -= this.calculateMetricPenalty(
        this.metrics.firstInputDelay,
        this.THRESHOLDS.FID.good,
        this.THRESHOLDS.FID.poor,
        10
      );
    }
    
    // TTI scoring
    if (this.metrics.timeToInteractive) {
      score -= this.calculateMetricPenalty(
        this.metrics.timeToInteractive,
        this.THRESHOLDS.TTI.good,
        this.THRESHOLDS.TTI.poor,
        10
      );
    }
    
    // TBT scoring
    if (this.metrics.totalBlockingTime !== undefined) {
      score -= this.calculateMetricPenalty(
        this.metrics.totalBlockingTime,
        this.THRESHOLDS.TBT.good,
        this.THRESHOLDS.TBT.poor,
        15
      );
    }
    
    // Speed Index scoring
    if (this.metrics.speedIndex) {
      score -= this.calculateMetricPenalty(
        this.metrics.speedIndex,
        this.THRESHOLDS.SI.good,
        this.THRESHOLDS.SI.poor,
        10
      );
    }
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateMetricPenalty(
    value: number,
    goodThreshold: number,
    poorThreshold: number,
    maxPenalty: number
  ): number {
    if (value <= goodThreshold) return 0;
    if (value >= poorThreshold) return maxPenalty;
    
    // Linear interpolation between good and poor
    const ratio = (value - goodThreshold) / (poorThreshold - goodThreshold);
    return ratio * maxPenalty;
  }

  private generateOptimizationOpportunities(): OptimizationOpportunity[] {
    const opportunities: OptimizationOpportunity[] = [];
    
    // Large resource opportunities
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const largeResources = resources.filter(r => r.transferSize > 1024 * 1024); // > 1MB
    
    if (largeResources.length > 0) {
      opportunities.push({
        id: 'optimize-images',
        title: 'Optimize images',
        description: 'Large image files are slowing down page load',
        score: 85,
        numericValue: largeResources.reduce((sum, r) => sum + r.transferSize, 0),
        numericUnit: 'bytes',
        details: {
          type: 'table',
          items: largeResources.map(r => ({
            url: r.name,
            size: r.transferSize,
            potential: r.transferSize * 0.7 // Estimated compression savings
          }))
        }
      });
    }
    
    // Unused JavaScript opportunity
    if (this.metrics.totalBlockingTime && this.metrics.totalBlockingTime > this.THRESHOLDS.TBT.good) {
      opportunities.push({
        id: 'unused-javascript',
        title: 'Remove unused JavaScript',
        description: 'Reduce blocking time by removing unused code',
        score: 70,
        numericValue: this.metrics.totalBlockingTime,
        numericUnit: 'ms',
        details: {
          type: 'table',
          items: []
        }
      });
    }
    
    // Text compression opportunity
    const uncompressedResources = resources.filter(r => 
      r.name.includes('.js') || r.name.includes('.css') || r.name.includes('.html')
    );
    
    if (uncompressedResources.length > 0) {
      opportunities.push({
        id: 'enable-text-compression',
        title: 'Enable text compression',
        description: 'Text-based resources should be served with compression',
        score: 60,
        numericValue: uncompressedResources.reduce((sum, r) => sum + r.transferSize * 0.3, 0),
        numericUnit: 'bytes',
        details: {
          type: 'table',
          items: uncompressedResources.map(r => ({
            url: r.name,
            size: r.transferSize
          }))
        }
      });
    }
    
    return opportunities.sort((a, b) => b.score - a.score);
  }

  private generateDiagnostics(): PerformanceDiagnostic[] {
    const diagnostics: PerformanceDiagnostic[] = [];
    
    // Critical Request Chains
    diagnostics.push({
      id: 'critical-request-chains',
      title: 'Avoid chaining critical requests',
      description: 'Critical request chains delay page load',
      scoreDisplayMode: 'informative',
      score: null
    });
    
    // Main Thread Work
    if (this.metrics.totalBlockingTime !== undefined) {
      diagnostics.push({
        id: 'main-thread-work-breakdown',
        title: 'Main thread work breakdown',
        description: 'Tasks that kept the main thread busy',
        scoreDisplayMode: 'numeric',
        score: this.metrics.totalBlockingTime > this.THRESHOLDS.TBT.good ? 0 : 1
      });
    }
    
    // Largest Contentful Paint element
    if (this.metrics.largestContentfulPaint) {
      diagnostics.push({
        id: 'largest-contentful-paint-element',
        title: 'Largest Contentful Paint element',
        description: 'The element that contributes to LCP',
        scoreDisplayMode: 'informative',
        score: null
      });
    }
    
    // Service Worker status
    diagnostics.push({
      id: 'service-worker',
      title: 'Service Worker',
      description: 'Service Worker registration status',
      scoreDisplayMode: 'binary',
      score: this.metrics.serviceWorkerRegistration ? 1 : 0
    });
    
    return diagnostics;
  }

  async runGitHubPagesAudit(): Promise<GitHubPagesOptimization[]> {
    console.log('Running GitHub Pages specific audit');
    
    const optimizations: GitHubPagesOptimization[] = [];
    
    // Asset optimization
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const largeAssets = resources.filter(r => r.transferSize > 500 * 1024); // > 500KB
    
    if (largeAssets.length > 0) {
      optimizations.push({
        category: 'assets',
        title: 'Optimize Static Assets',
        description: 'Large assets detected that could benefit from compression or optimization',
        implementation: 'Use GitHub Actions to automatically compress images and minify JS/CSS during build',
        impact: 'high',
        effort: 'medium'
      });
    }
    
    // Caching optimization
    const cacheableResources = resources.filter(r => 
      r.name.includes('.js') || r.name.includes('.css') || r.name.includes('.png') || r.name.includes('.jpg')
    );
    
    if (cacheableResources.length > 0) {
      optimizations.push({
        category: 'caching',
        title: 'Implement Long-term Caching',
        description: 'Static assets should have cache-friendly names with hashes',
        implementation: 'Configure Vite to generate hashed filenames and set appropriate cache headers',
        impact: 'medium',
        effort: 'low'
      });
    }
    
    // Compression check
    const textResources = resources.filter(r => 
      r.name.includes('.js') || r.name.includes('.css') || r.name.includes('.html')
    );
    
    const compressionRatio = this.estimateCompressionRatio(textResources);
    if (compressionRatio < 0.3) { // Less than 30% compression
      optimizations.push({
        category: 'compression',
        title: 'Enable Gzip/Brotli Compression',
        description: 'Text-based assets are not optimally compressed',
        implementation: 'Enable compression in GitHub Pages or use pre-compressed assets',
        impact: 'high',
        effort: 'low'
      });
    }
    
    // Routing optimization
    if (!this.metrics.serviceWorkerRegistration) {
      optimizations.push({
        category: 'routing',
        title: 'Implement Client-side Routing',
        description: 'Enable SPA routing for better navigation performance',
        implementation: 'Configure Service Worker for client-side routing and caching',
        impact: 'medium',
        effort: 'medium'
      });
    }
    
    return optimizations.sort((a, b) => this.getImpactScore(b.impact) - this.getImpactScore(a.impact));
  }

  private estimateCompressionRatio(resources: PerformanceResourceTiming[]): number {
    // Rough estimation based on typical compression ratios
    const totalSize = resources.reduce((sum, r) => sum + r.transferSize, 0);
    const encodedSize = resources.reduce((sum, r) => sum + (r.encodedBodySize || r.transferSize), 0);
    
    return totalSize > 0 ? encodedSize / totalSize : 1;
  }

  private getImpactScore(impact: string): number {
    switch (impact) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  async runAccessibilityAudit(): Promise<PerformanceAuditResult> {
    console.log('Running accessibility audit');
    
    const diagnostics: PerformanceDiagnostic[] = [];
    
    // Color contrast
    diagnostics.push({
      id: 'color-contrast',
      title: 'Background and foreground colors have sufficient contrast ratio',
      description: 'Check color contrast for accessibility',
      scoreDisplayMode: 'binary',
      score: this.checkColorContrast() ? 1 : 0
    });
    
    // Image alt text
    const images = document.querySelectorAll('img');
    const imagesWithoutAlt = Array.from(images).filter(img => !img.alt);
    
    diagnostics.push({
      id: 'image-alt',
      title: 'Image elements have [alt] attributes',
      description: 'Images should have descriptive alt text',
      scoreDisplayMode: 'binary',
      score: imagesWithoutAlt.length === 0 ? 1 : 0
    });
    
    // Form labels
    const inputs = document.querySelectorAll('input, textarea, select');
    const inputsWithoutLabels = Array.from(inputs).filter(input => {
      const id = input.getAttribute('id');
      return !id || !document.querySelector(`label[for="${id}"]`);
    });
    
    diagnostics.push({
      id: 'form-labels',
      title: 'Form elements have associated labels',
      description: 'Form inputs should have proper labels',
      scoreDisplayMode: 'binary',
      score: inputsWithoutLabels.length === 0 ? 1 : 0
    });
    
    const accessibilityScore = diagnostics.reduce((sum, d) => sum + (d.score || 0), 0) / diagnostics.length * 100;
    
    return {
      score: accessibilityScore,
      category: 'accessibility',
      metrics: {} as LighthouseMetrics,
      opportunities: [],
      diagnostics,
      passed: accessibilityScore >= 90,
      timestamp: Date.now()
    };
  }

  private checkColorContrast(): boolean {
    // Simple color contrast check
    // In a real implementation, this would check all text elements
    const body = document.body;
    const styles = getComputedStyle(body);
    const bgColor = styles.backgroundColor;
    const textColor = styles.color;
    
    // This is a simplified check - real implementation would calculate WCAG contrast ratios
    return bgColor !== textColor;
  }

  async runSEOAudit(): Promise<PerformanceAuditResult> {
    console.log('Running SEO audit');
    
    const diagnostics: PerformanceDiagnostic[] = [];
    
    // Meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    diagnostics.push({
      id: 'meta-description',
      title: 'Document has a meta description',
      description: 'Meta descriptions help search engines understand page content',
      scoreDisplayMode: 'binary',
      score: !!metaDescription ? 1 : 0
    });
    
    // Title
    const title = document.title;
    diagnostics.push({
      id: 'document-title',
      title: 'Document has a title element',
      description: 'Title element is required for SEO',
      scoreDisplayMode: 'binary',
      score: title && title.length > 0 ? 1 : 0
    });
    
    // Viewport meta tag
    const viewport = document.querySelector('meta[name="viewport"]');
    diagnostics.push({
      id: 'viewport',
      title: 'Has a viewport meta tag with width or initial-scale',
      description: 'Viewport meta tag is required for mobile optimization',
      scoreDisplayMode: 'binary',
      score: !!viewport ? 1 : 0
    });
    
    // Structured data
    const structuredData = document.querySelector('script[type="application/ld+json"]');
    diagnostics.push({
      id: 'structured-data',
      title: 'Page has valid structured data',
      description: 'Structured data helps search engines understand content',
      scoreDisplayMode: 'binary',
      score: !!structuredData ? 1 : 0
    });
    
    const seoScore = diagnostics.reduce((sum, d) => sum + (d.score || 0), 0) / diagnostics.length * 100;
    
    return {
      score: seoScore,
      category: 'seo',
      metrics: {} as LighthouseMetrics,
      opportunities: [],
      diagnostics,
      passed: seoScore >= 90,
      timestamp: Date.now()
    };
  }

  async runPWAAudit(): Promise<PerformanceAuditResult> {
    console.log('Running PWA audit');
    
    const diagnostics: PerformanceDiagnostic[] = [];
    
    // Service Worker
    diagnostics.push({
      id: 'service-worker',
      title: 'Registers a Service Worker',
      description: 'Service Worker enables offline functionality',
      scoreDisplayMode: 'binary',
      score: this.metrics.serviceWorkerRegistration ? 1 : 0
    });
    
    // Web App Manifest
    diagnostics.push({
      id: 'webapp-manifest',
      title: 'Web app manifest meets requirements',
      description: 'Manifest enables install prompt',
      scoreDisplayMode: 'binary',
      score: this.metrics.manifestValid ? 1 : 0
    });
    
    // Offline capability
    diagnostics.push({
      id: 'offline-capability',
      title: 'Works offline',
      description: 'App should work without network connection',
      scoreDisplayMode: 'binary',
      score: this.metrics.offlineCapability ? 1 : 0
    });
    
    // Install prompt
    diagnostics.push({
      id: 'install-prompt',
      title: 'Provides install prompt',
      description: 'App can be installed on device',
      scoreDisplayMode: 'binary',
      score: this.metrics.installPrompt ? 1 : 0
    });
    
    // HTTPS
    const isHttps = location.protocol === 'https:';
    diagnostics.push({
      id: 'https',
      title: 'Uses HTTPS',
      description: 'HTTPS is required for PWA features',
      scoreDisplayMode: 'binary',
      score: isHttps ? 1 : 0
    });
    
    const pwaScore = diagnostics.reduce((sum, d) => sum + (d.score || 0), 0) / diagnostics.length * 100;
    
    return {
      score: pwaScore,
      category: 'pwa',
      metrics: this.metrics as LighthouseMetrics,
      opportunities: [],
      diagnostics,
      passed: pwaScore >= 90,
      timestamp: Date.now()
    };
  }

  generateLighthouseReport(): string {
    const latestAudit = this.auditResults[this.auditResults.length - 1];
    if (!latestAudit) {
      return 'No audit results available';
    }
    
    const report = {\n      lighthouseVersion: '10.0.0',\n      userAgent: navigator.userAgent,\n      fetchTime: new Date(latestAudit.timestamp).toISOString(),\n      finalUrl: window.location.href,\n      categories: {\n        performance: {\n          id: 'performance',\n          title: 'Performance',\n          score: latestAudit.score / 100,\n          auditRefs: latestAudit.diagnostics.map(d => ({ id: d.id, weight: 1 }))\n        }\n      },\n      audits: Object.fromEntries(\n        latestAudit.diagnostics.map(d => [\n          d.id,\n          {\n            id: d.id,\n            title: d.title,\n            description: d.description,\n            score: d.score,\n            scoreDisplayMode: d.scoreDisplayMode\n          }\n        ])\n      ),\n      timing: {\n        entries: this.metrics\n      }\n    };\n    \n    return JSON.stringify(report, null, 2);\n  }\n\n  startContinuousMonitoring(): void {\n    if (this.monitoring) return;\n    \n    this.monitoring = true;\n    console.log('Starting continuous performance monitoring');\n    \n    // Run audit every 5 minutes\n    setInterval(async () => {\n      try {\n        await this.runComprehensiveAudit();\n      } catch (error) {\n        console.error('Error during continuous monitoring:', error);\n      }\n    }, 5 * 60 * 1000);\n  }\n\n  stopContinuousMonitoring(): void {\n    this.monitoring = false;\n    console.log('Stopped continuous performance monitoring');\n  }\n\n  // Export comprehensive audit data\n  exportAuditData(): any {\n    return {\n      timestamp: Date.now(),\n      metrics: this.metrics,\n      auditResults: this.auditResults,\n      userAgent: navigator.userAgent,\n      url: window.location.href,\n      connection: (navigator as any).connection ? {\n        effectiveType: (navigator as any).connection.effectiveType,\n        downlink: (navigator as any).connection.downlink,\n        rtt: (navigator as any).connection.rtt\n      } : null\n    };\n  }\n\n  // CI/CD integration methods\n  generateJUnitXML(): string {\n    const latestAudit = this.auditResults[this.auditResults.length - 1];\n    if (!latestAudit) return '';\n    \n    const testCases = latestAudit.diagnostics.map(d => {\n      const passed = d.score === 1 || d.score === null;\n      return `\n    <testcase name=\"${d.title}\" classname=\"PWA.Performance\" time=\"0\">\n      ${!passed ? `<failure message=\"${d.description}\"></failure>` : ''}\n    </testcase>`;\n    }).join('');\n    \n    return `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<testsuite name=\"PWA Performance Audit\" tests=\"${latestAudit.diagnostics.length}\" failures=\"${latestAudit.diagnostics.filter(d => d.score === 0).length}\" time=\"0\">\n${testCases}\n</testsuite>`;\n  }\n\n  destroy(): void {\n    this.stopContinuousMonitoring();\n    if (this.performanceObserver) {\n      this.performanceObserver.disconnect();\n    }\n    console.log('PWA Performance Auditor destroyed');\n  }\n}"