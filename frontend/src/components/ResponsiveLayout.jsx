import React, { useState, useEffect, useCallback } from 'react';

// Breakpoint definitions
const BREAKPOINTS = {
  MOBILE: 480,
  TABLET: 768,
  DESKTOP: 1024,
  LARGE_DESKTOP: 1440
};

const ResponsiveLayout = ({ children, className = "" }) => {
  const [breakpoint, setBreakpoint] = useState('mobile');
  const [windowSize, setWindowSize] = useState({
    width: 0,
    height: 0
  });
  const [orientation, setOrientation] = useState('portrait');
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  // Determine current breakpoint based on window width
  const determineBreakpoint = useCallback((width) => {
    if (width < BREAKPOINTS.MOBILE) return 'small-mobile';
    if (width < BREAKPOINTS.TABLET) return 'mobile';
    if (width < BREAKPOINTS.DESKTOP) return 'tablet';
    if (width < BREAKPOINTS.LARGE_DESKTOP) return 'desktop';
    return 'large-desktop';
  }, []);

  // Handle window resize with debouncing
  useEffect(() => {
    let resizeTimeout;

    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const width = window.innerWidth;
        const height = window.innerHeight;

        setWindowSize({ width, height });
        setBreakpoint(determineBreakpoint(width));
        setOrientation(width > height ? 'landscape' : 'portrait');
        setIsSmallScreen(width < 400);
      }, 100);
    };

    // Initial measurement
    handleResize();

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [determineBreakpoint]);

  // Utility functions for responsive behavior
  const isMobile = breakpoint === 'mobile' || breakpoint === 'small-mobile';
  const isTablet = breakpoint === 'tablet';
  const isDesktop = breakpoint === 'desktop' || breakpoint === 'large-desktop';
  const isLargeDesktop = breakpoint === 'large-desktop';

  // Responsive value helpers
  const getResponsiveValue = (values) => {
    if (typeof values === 'object' && values !== null) {
      return values[breakpoint] || values.mobile || values.default;
    }
    return values;
  };

  const getResponsiveSpacing = (multiplier = 1) => {
    const baseSpacing = 16; // 1rem = 16px
    const spacings = {
      'small-mobile': baseSpacing * 0.75 * multiplier,
      'mobile': baseSpacing * multiplier,
      'tablet': baseSpacing * 1.25 * multiplier,
      'desktop': baseSpacing * 1.5 * multiplier,
      'large-desktop': baseSpacing * 2 * multiplier
    };
    return spacings[breakpoint];
  };

  const getResponsiveColumns = (defaultCols = 1) => {
    const columnConfigs = {
      'small-mobile': 1,
      'mobile': defaultCols,
      'tablet': Math.min(defaultCols + 1, 3),
      'desktop': Math.min(defaultCols + 2, 4),
      'large-desktop': Math.min(defaultCols + 3, 6)
    };
    return columnConfigs[breakpoint];
  };

  const getResponsiveFontSize = (baseSize, scale = 1) => {
    const scales = {
      'small-mobile': 0.75,
      'mobile': 0.875,
      'tablet': 1,
      'desktop': 1.125,
      'large-desktop': 1.25
    };
    return `${baseSize * scales[breakpoint] * scale}px`;
  };

  // CSS custom properties for responsive behavior
  const responsiveStyles = {
    '--breakpoint': breakpoint,
    '--is-mobile': isMobile ? '1' : '0',
    '--is-tablet': isTablet ? '1' : '0',
    '--is-desktop': isDesktop ? '1' : '0',
    '--is-large-desktop': isLargeDesktop ? '1' : '0',
    '--is-small-screen': isSmallScreen ? '1' : '0',
    '--is-landscape': orientation === 'landscape' ? '1' : '0',
    '--is-portrait': orientation === 'portrait' ? '1' : '0',
    '--window-width': `${windowSize.width}px`,
    '--window-height': `${windowSize.height}px`,
    '--responsive-spacing': `${getResponsiveSpacing()}px`,
    '--responsive-columns': getResponsiveColumns()
  };

  // Context for responsive utilities
  const contextValue = {
    breakpoint,
    windowSize,
    orientation,
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    isSmallScreen,
    getResponsiveValue,
    getResponsiveSpacing,
    getResponsiveColumns,
    getResponsiveFontSize
  };

  return (
    <div
      className={`responsive-layout ${className} ${breakpoint} ${orientation}`}
      style={responsiveStyles}
    >
      <ResponsiveContext.Provider value={contextValue}>
        {children}
      </ResponsiveContext.Provider>
    </div>
  );
};

// Context for consuming responsive utilities
const ResponsiveContext = React.createContext();

// Hook for using responsive context
export const useResponsive = () => {
  const context = React.useContext(ResponsiveContext);
  if (!context) {
    throw new Error('useResponsive must be used within a ResponsiveLayout component');
  }
  return context;
};

// Utility hook for media queries
export const useMediaQuery = (query) => {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (event) => setMatches(event.matches);
    media.addEventListener('change', listener);

    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
};

// Hook for breakpoint-specific behavior
export const useBreakpoint = () => {
  const { breakpoint } = useResponsive();
  return {
    isSmallMobile: breakpoint === 'small-mobile',
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    isLargeDesktop: breakpoint === 'large-desktop',
    isMobileOrTablet: breakpoint === 'mobile' || breakpoint === 'tablet' || breakpoint === 'small-mobile',
    isDesktopOrLarger: breakpoint === 'desktop' || breakpoint === 'large-desktop'
  };
};

// Responsive wrapper component
export const ResponsiveWrapper = ({
  children,
  className = "",
  breakpoint: visibleBreakpoint = 'all',
  hideOn = [],
  ...props
}) => {
  const { breakpoint: currentBreakpoint } = useResponsive();

  // Check if component should be hidden on current breakpoint
  const shouldHide = hideOn.includes(currentBreakpoint);

  // Check if component should be visible only on specific breakpoint
  const isVisible = visibleBreakpoint === 'all' || visibleBreakpoint === currentBreakpoint;

  if (shouldHide || !isVisible) {
    return null;
  }

  return (
    <div
      className={`responsive-wrapper ${className} ${currentBreakpoint}`}
      data-breakpoint={currentBreakpoint}
      {...props}
    >
      {children}
    </div>
  );
};

// Responsive image component
export const ResponsiveImage = ({
  src,
  alt,
  className = "",
  sizes = {},
  loading = "lazy",
  ...props
}) => {
  const { breakpoint } = useResponsive();

  // Get appropriate image source for current breakpoint
  const getSrcSet = () => {
    if (typeof src === 'string') return src;
    if (typeof src === 'object' && src !== null) {
      return src[breakpoint] || src.mobile || src.default;
    }
    return src;
  };

  // Generate srcset for responsive images
  const generateSrcSet = () => {
    if (typeof src === 'object' && src !== null) {
      return Object.entries(src)
        .map(([bp, url]) => {
          const bpWidth = {
            'small-mobile': 320,
            'mobile': 480,
            'tablet': 768,
            'desktop': 1024,
            'large-desktop': 1440
          }[bp] || 1024;
          return `${url} ${bpWidth}w`;
        })
        .join(', ');
    }
    return null;
  };

  const imageSizes = {
    smallMobile: '320px',
    mobile: '480px',
    tablet: '768px',
    desktop: '1024px',
    largeDesktop: '1440px',
    ...sizes
  };

  return (
    <img
      src={getSrcSet()}
      srcSet={generateSrcSet()}
      sizes={imageSizes[breakpoint]}
      alt={alt}
      className={`responsive-image ${className}`}
      loading={loading}
      {...props}
    />
  );
};

// Hook for intersection observer (useful for lazy loading)
export const useIntersectionObserver = (
  options = {
    threshold: 0,
    rootMargin: '0px',
    triggerOnce: false
  }
) => {
  const [isIntersecting, setIsIntersecting] = React.useState(false);
  const [hasIntersected, setHasIntersected] = React.useState(false);
  const elementRef = React.useRef();

  React.useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);

      if (entry.isIntersecting && options.triggerOnce) {
        setHasIntersected(true);
        observer.disconnect();
      }
    }, {
      threshold: options.threshold,
      rootMargin: options.rootMargin
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [options.threshold, options.rootMargin, options.triggerOnce]);

  return {
    isIntersecting,
    hasIntersected,
    elementRef
  };
};

export default ResponsiveLayout;
export { ResponsiveContext };