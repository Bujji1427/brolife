import React, { useState } from 'react';
import './App.css';

// Components
import ChatBox from './components/ChatBox';
import TimetableCard from './components/TimetableCard';
import TrackerCard from './components/TrackerCard';
import ProfileView from './components/ProfileView';
import BottomNav from './components/BottomNav';
import HomePage from './pages/HomePage';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/ToastNotifications';

// Hooks
import { useUser, useTimetable, useChat } from './hooks';
import { setGlobalToastContext } from './components/ToastNotifications';

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [showSetup, setShowSetup] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [expandedTracker, setExpandedTracker] = useState(null);
  const [inputMessage, setInputMessage] = useState('');
  const [goals, setGoals] = useState('');
  const [preferences, setPreferences] = useState('');
  const [broName, setBroName] = useState('Bro');

  // Custom hooks
  const { user, updateUser } = useUser();
  const { timetable, generateTimetable, loading: timetableLoading, setTimetable } = useTimetable();
  const { messages, sendMessage, addMessage, isLoading: chatLoading } = useChat();

  // Sample tracker data (in real app, this would come from API)
  const [trackerData] = useState({
    health: {
      sleep: { value: 7.5, target: 8, unit: 'hours' },
      hydration: { value: 6, target: 8, unit: 'glasses' },
      energy: { value: 75, target: 100, unit: '%' }
    },
    food: {
      meals: { value: 2, target: 3, unit: 'meals' },
      outsideFood: { value: 1, target: 0, unit: 'times' },
      quality: { value: 80, target: 90, unit: '%' }
    },
    learning: {
      studyTime: { value: 2.5, target: 3, unit: 'hours' },
      streak: { value: 12, target: 30, unit: 'days' },
      progress: { value: 65, target: 100, unit: '%' }
    },
    goals: {
      shortTerm: { value: 3, target: 5, unit: 'tasks' },
      longTerm: { value: 40, target: 100, unit: '%' },
      weekly: { value: 5, target: 7, unit: 'days' }
    }
  });

  const handleGenerateTimetable = async () => {
    if (!user.goals || user.goals.length === 0) {
      addMessage({ 
        type: 'bot', 
        content: "Hey! Set up your goals first so I can create a personalized timetable for you. Click the profile tab! 🎯"
      });
      return;
    }

    addMessage({ 
      type: 'user', 
      content: "Generate my daily timetable"
    });

    try {
      const data = await generateTimetable(user.goals, user.preferences, user.user_id);
      addMessage({ 
        type: 'bot', 
        content: "Your personalized timetable is ready! Check it out in the Timetable tab 📅",
        timetable: data.timetable
      });
    } catch (error) {
      // Create a fallback timetable for demo purposes
      const fallbackTimetable = {
        date: new Date().toISOString().split('T')[0],
        day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
        night_focus: new Date().getDay() % 2 === 0 ? "Health & Wellness" : "Side Hustle",
        schedule_text: `Here's your productivity schedule for today!\n\n🌅 Morning (7:30-12:00):\n- Focus work on: ${user.goals[0] || 'your main goal'}\n- 90-minute deep work blocks\n- Strategic planning time\n\n☀️ Afternoon (12:00-17:00):\n- Continue project momentum\n- Lunch break (12:30-13:30)\n- Admin tasks and emails\n\n🌆 Evening (17:00-21:00):\n- Personal time and exercise\n- Dinner and relaxation\n- Quality time with family/friends\n\n🌙 Night (21:00-00:30):\n- ${new Date().getDay() % 2 === 0 ? "Health focus: yoga, meditation, sleep prep" : "Side hustle: work on personal projects"}\n\nLet's crush this day! 💪`,
        generated_at: new Date().toISOString()
      };
      
      setTimetable(fallbackTimetable);
      addMessage({ 
        type: 'bot', 
        content: "I generated a solid schedule for you! Check it out in the Timetable tab 📅"
      });
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || chatLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');

    try {
      await sendMessage(userMessage, user.user_id);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const saveUserSetup = async () => {
    const goalsList = goals.split('\n').filter(g => g.trim()).map(g => g.trim());
    
    try {
      const response = await updateUser({
        user_id: 'default_user',
        bro_name: broName,
        goals: goalsList,
        preferences: preferences
      });
      
      setShowSetup(false);
      addMessage({ 
        type: 'bot', 
        content: response.message
      });
    } catch (error) {
      console.error('Error saving setup:', error);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomePage
            user={user}
            timetable={timetable}
            trackerData={trackerData}
            expandedTracker={expandedTracker}
            setExpandedTracker={setExpandedTracker}
            onGenerateTimetable={handleGenerateTimetable}
            onViewFullSchedule={() => setActiveTab('timetable')}
            isLoading={timetableLoading || chatLoading}
            messages={messages}
            inputMessage={inputMessage}
            setInputMessage={setInputMessage}
            onSendMessage={handleSendMessage}
            handleKeyPress={handleKeyPress}
          />
        );

      case 'chat':
        return (
          <ChatBox
            user={user}
            className="full-chat"
          />
        );

      case 'timetable':
        return (
          <TimetableCard
            timetable={timetable}
            onRegenerate={handleGenerateTimetable}
            isLoading={timetableLoading}
          />
        );

      case 'trackers':
        return (
          <div className="trackers-view">
            <div className="trackers-header">
              <h2>📊 Your Progress Trackers</h2>
              <span className="date">Today</span>
            </div>
            
            <div className="trackers-full">
              <TrackerCard 
                title="Health Tracker" 
                icon="💪" 
                data={trackerData.health} 
                category="health"
                isExpanded={expandedTracker === 'health'}
                onToggle={() => setExpandedTracker(expandedTracker === 'health' ? null : 'health')}
              />
              <TrackerCard 
                title="Food Tracker" 
                icon="🍎" 
                data={trackerData.food} 
                category="food"
                isExpanded={expandedTracker === 'food'}
                onToggle={() => setExpandedTracker(expandedTracker === 'food' ? null : 'food')}
              />
              <TrackerCard 
                title="Learning Tracker" 
                icon="🧠" 
                data={trackerData.learning} 
                category="learning"
                isExpanded={expandedTracker === 'learning'}
                onToggle={() => setExpandedTracker(expandedTracker === 'learning' ? null : 'learning')}
              />
              <TrackerCard 
                title="Goals Tracker" 
                icon="🎯" 
                data={trackerData.goals} 
                category="goals"
                isExpanded={expandedTracker === 'goals'}
                onToggle={() => setExpandedTracker(expandedTracker === 'goals' ? null : 'goals')}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <ErrorBoundary>
      <ToastProvider>
        <div className="App">
          <div className="mobile-container">
        {/* Top Header */}
        <div className="app-header">
          <div className="app-title">
            <h1>💪 Brolife</h1>
            <span className="subtitle">Your AI productivity bro</span>
          </div>
          <div className="header-right">
            <button className="feedback-btn" onClick={() => setShowFeedback(true)}>
              💬 Feedback
            </button>
            <div className="profile-icon" onClick={() => setActiveTab('profile')}>
              <span className="bro-name">{user.bro_name}</span>
              <div className="avatar-small">🤖</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="main-content">
          {activeTab === 'profile' ? (
            <ProfileView
              user={user}
              onEditClick={() => setShowSetup(true)}
            />
          ) : (
            renderTabContent()
          )}
        </div>

        {/* Bottom Navigation */}
        <BottomNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {/* Setup Modal */}
      {showSetup && (
        <div className="modal-overlay" onClick={() => setShowSetup(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🛠️ Setup Your Brolife</h2>
              <button className="close-btn" onClick={() => setShowSetup(false)}>×</button>
            </div>
            
            <div className="modal-content">
              <div className="form-group">
                <label>What should I call you as your bro? 🤝</label>
                <input
                  type="text"
                  value={broName}
                  onChange={(e) => setBroName(e.target.value)}
                  placeholder="Bro, Buddy, Coach, etc."
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>What are your main goals? 🎯 (one per line)</label>
                <textarea
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  placeholder="Learn machine learning&#10;Build my side project&#10;Get fit and healthy&#10;Read 2 books per month"
                  className="form-textarea"
                  rows="6"
                />
              </div>

              <div className="form-group">
                <label>Any preferences or constraints? ⚙️</label>
                <textarea
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  placeholder="I work best in the morning, prefer shorter breaks, have gym at 6 PM..."
                  className="form-textarea"
                  rows="3"
                />
              </div>

              <button className="save-btn" onClick={saveUserSetup}>
                💾 Save & Start
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Feedback Modal */}
      {showFeedback && (
        <div className="modal-overlay" onClick={() => setShowFeedback(false)}>
          <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>💬 Share Your Feedback</h2>
              <button className="close-btn" onClick={() => setShowFeedback(false)}>×</button>
            </div>
            
            <div className="modal-content">
              <div className="form-group">
                <label>Name (optional)</label>
                <input
                  type="text"
                  placeholder="Your name"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Your feedback *</label>
                <textarea
                  placeholder="Tell us what you think about Brolife, what features you'd like, or any bugs you've found..."
                  className="form-textarea"
                  rows="5"
                  required
                />
              </div>

              <button 
                className="submit-feedback-btn"
                onClick={() => {
                  console.log('Feedback submitted!');
                  setShowFeedback(false);
                  // Could send to API in future
                }}
              >
                🚀 Submit Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;