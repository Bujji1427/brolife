import React, { useState, useEffect } from 'react';

const BottomNav = ({ activeTab, onTabChange }) => {
  const [isDesktop, setIsDesktop] = useState(false);

  // Detect screen size for responsive navigation
  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const navItems = [
    { id: 'home', icon: '🏠', label: 'Home', desktopLabel: 'Dashboard' },
    { id: 'chat', icon: '💬', label: 'Chat', desktopLabel: 'AI Assistant' },
    { id: 'timetable', icon: '📅', label: 'Schedule', desktopLabel: 'Timetable' },
    { id: 'trackers', icon: '📊', label: 'Trackers', desktopLabel: 'Progress' }
  ];

  // For desktop, show as sidebar navigation
  if (isDesktop) {
    return (
      <div className="desktop-nav">
        <div className="desktop-nav-left">
          <div className="desktop-nav-brand">
            <span className="brand-icon">💪</span>
            <span className="brand-text">Brolife</span>
          </div>
          <div className="desktop-nav-menu">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`desktop-nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => onTabChange(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.desktopLabel}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="desktop-nav-right">
          <button className="desktop-nav-item" title="Settings">
            ⚙️
          </button>
        </div>
      </div>
    );
  }

  // For mobile and tablet, show bottom navigation
  return (
    <div className="bottom-nav">
      <div className="nav-items">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''} keyboard-focus`}
            onClick={() => onTabChange(item.id)}
            aria-label={item.label}
            aria-current={activeTab === item.id ? 'page' : undefined}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Active tab indicator for mobile */}
      <div className="nav-indicator" style={{ '--active-index': navItems.findIndex(item => item.id === activeTab) }}></div>
    </div>
  );
};

export default BottomNav;