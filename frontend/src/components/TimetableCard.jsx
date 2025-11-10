import React, { useState, useEffect } from 'react';
import DailyLogger from './DailyLogger';
import { storageManager } from '../utils/storageManager';
import { useToast } from './ToastNotifications';

const EditableTimeBlock = ({ time, task, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState(task);

  const handleSave = () => {
    onSave(time, editedTask);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="activity editing">
        <span className="time">{time}</span>
        <input 
          type="text" 
          value={editedTask} 
          onChange={(e) => setEditedTask(e.target.value)}
          className="edit-input"
          autoFocus
        />
        <div className="edit-actions">
          <button onClick={handleSave} className="save-btn">✓</button>
          <button onClick={() => setIsEditing(false)} className="cancel-btn">✕</button>
        </div>
      </div>
    );
  }

  return (
    <div className="activity">
      <span className="time">{time}</span>
      <span className="task">{editedTask}</span>
      <button 
        className="edit-icon" 
        onClick={() => setIsEditing(true)}
      >
        ✏️
      </button>
    </div>
  );
};

const TimetableCard = ({ timetable, onViewFullSchedule, onRegenerate, isLoading = false, isPreview = false }) => {
  const [showLogger, setShowLogger] = useState(false);
  const [editedTasks, setEditedTasks] = useState({});
  const [storageWarning, setStorageWarning] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('saved'); // saved, saving, error
  const { addToast } = useToast();

  // Load edited tasks from storage on mount
  useEffect(() => {
    const loadEditedTasks = async () => {
      try {
        const savedTasks = await storageManager.getItem('brolife_edited_tasks');
        if (savedTasks) {
          setEditedTasks(savedTasks);
        }
      } catch (error) {
        console.warn('Failed to load edited tasks from storage:', error);
        addToast({
          type: 'warning',
          title: 'Storage Issue',
          message: 'Could not load saved edits. Some edits may be lost.',
          duration: 5000
        });
      }
    };

    loadEditedTasks();
  }, [addToast]);

  // Listen for storage quota warnings
  useEffect(() => {
    const handleStorageWarning = (event) => {
      const { usageRatio, remainingBytes } = event.detail;
      setStorageWarning(true);

      addToast({
        type: 'warning',
        title: 'Storage Almost Full',
        message: `Browser storage is ${usageRatio}% full. Consider clearing old data.`,
        duration: 8000,
        action: {
          label: 'Clear Edits',
          handler: async () => {
            try {
              await storageManager.removeItem('brolife_edited_tasks');
              setEditedTasks({});
              setStorageWarning(false);
              addToast({
                type: 'success',
                title: 'Edits Cleared',
                message: 'Your saved edits have been cleared.',
                duration: 3000
              });
            } catch (error) {
              console.error('Failed to clear edits:', error);
            }
          }
        }
      });
    };

    window.addEventListener('storageWarning', handleStorageWarning);
    return () => window.removeEventListener('storageWarning', handleStorageWarning);
  }, [addToast]);

  const handleTaskEdit = async (time, newTask) => {
    try {
      setAutoSaveStatus('saving');

      // Update local state first for immediate UI feedback
      setEditedTasks(prev => ({
        ...prev,
        [time]: newTask
      }));

      // Save to enhanced storage manager
      await storageManager.setItem('brolife_edited_tasks', {
        ...editedTasks,
        [time]: newTask
      }, {
        compress: true,
        persistent: true
      });

      setAutoSaveStatus('saved');
      setStorageWarning(false);

    } catch (error) {
      setAutoSaveStatus('error');
      console.error('Failed to save edited task:', error);

      const errorType = error.name || 'unknown';

      if (errorType === 'QuotaExceededError' || error.message?.includes('quota')) {
        setStorageWarning(true);
        addToast({
          type: 'error',
          title: 'Storage Full',
          message: 'Cannot save edits: storage is full. Clear some data to continue.',
          duration: 8000,
          action: {
            label: 'Clear All Edits',
            handler: async () => {
              try {
                await storageManager.removeItem('brolife_edited_tasks');
                setEditedTasks({});
                setStorageWarning(false);
                setAutoSaveStatus('saved');
                addToast({
                  type: 'success',
                  title: 'Edits Cleared',
                  message: 'All edits have been cleared to free up space.',
                  duration: 4000
                });
              } catch (clearError) {
                console.error('Failed to clear edits:', clearError);
              }
            }
          }
        });
      } else {
        addToast({
          type: 'error',
          title: 'Save Failed',
          message: 'Could not save your edit. Please try again.',
          duration: 5000,
          action: {
            label: 'Retry',
            handler: () => handleTaskEdit(time, newTask)
          }
        });
      }
    }
  };

  const clearAllEdits = async () => {
    try {
      setAutoSaveStatus('saving');
      await storageManager.removeItem('brolife_edited_tasks');
      setEditedTasks({});
      setStorageWarning(false);
      setAutoSaveStatus('saved');

      addToast({
        type: 'success',
        title: 'Edits Cleared',
        message: 'All your timetable edits have been cleared.',
        duration: 4000
      });
    } catch (error) {
      setAutoSaveStatus('error');
      console.error('Failed to clear edits:', error);
      addToast({
        type: 'error',
        title: 'Failed to Clear',
        message: 'Could not clear edits. Please try again.',
        duration: 5000
      });
    }
  };

  const getTaskText = (time, defaultTask) => {
    return editedTasks[time] || defaultTask;
  };
  
  if (!timetable) {
    return (
      <div className="no-timetable">
        <div className="empty-state">
          <h3>📅 No Timetable Yet</h3>
          <p>Generate your personalized daily schedule based on your goals and preferences.</p>
          <button className="generate-btn" onClick={onRegenerate} disabled={isLoading}>
            {isLoading ? '⏳ Generating...' : '🎯 Generate My Timetable'}
          </button>
        </div>
      </div>
    );
  }

  if (isPreview) {
    return (
      <div className="timetable-card">
        <div className="timetable-header">
          <h3>📅 Today's Schedule</h3>
          <span className="date">{timetable.day}, {timetable.date}</span>
        </div>
        <div className="night-focus">
          🌙 Tonight's Focus: <span className="focus-type">{timetable.night_focus}</span>
        </div>
        <div className="schedule-preview">
          <div className="time-blocks">
            <div className="time-block morning">
              <span className="time">7:30-12:00</span>
              <span className="activity">🌅 Morning Focus</span>
            </div>
            <div className="time-block afternoon">
              <span className="time">12:00-17:00</span>
              <span className="activity">☀️ Mixed Tasks</span>
            </div>
            <div className="time-block evening">
              <span className="time">17:00-21:00</span>
              <span className="activity">🌆 Personal Time</span>
            </div>
            <div className="time-block night">
              <span className="time">21:00-00:30</span>
              <span className="activity">🌙 {timetable.night_focus}</span>
            </div>
          </div>
        </div>
        <button 
          className="view-full-btn"
          onClick={onViewFullSchedule}
        >
          View Full Schedule
        </button>
      </div>
    );
  }

  return (
    <div className="timetable-view">
      <div className="timetable-header">
        <h2>📅 {showLogger ? 'Log Your Day' : 'Your Daily Timetable'}</h2>
        <div className="header-actions">
          {/* Storage Status Indicator */}
          {!showLogger && (
            <div className="storage-status">
              {autoSaveStatus === 'saving' && <span className="save-indicator saving">💾 Saving...</span>}
              {autoSaveStatus === 'saved' && <span className="save-indicator saved">✓ Saved</span>}
              {autoSaveStatus === 'error' && <span className="save-indicator error">⚠️ Save Failed</span>}
            </div>
          )}
          <button
            className="toggle-view-btn"
            onClick={() => setShowLogger(!showLogger)}
          >
            {showLogger ? '📅 Schedule' : '📝 Log Day'}
          </button>
          {!showLogger && (
            <button className="regenerate-btn" onClick={onRegenerate} disabled={isLoading}>
              🔄
            </button>
          )}
          {Object.keys(editedTasks).length > 0 && !showLogger && (
            <button
              className="clear-edits-btn"
              onClick={clearAllEdits}
              title="Clear all edits"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* Storage Warning Banner */}
      {storageWarning && (
        <div className="storage-warning">
          <span className="warning-icon">⚠️</span>
          <span className="warning-text">Storage is almost full. Your edits may not be saved properly.</span>
          <button className="warning-action" onClick={clearAllEdits}>
            Clear All Edits
          </button>
        </div>
      )}
      
      <div className="content-container">
        <div className={`schedule-section ${showLogger ? 'hidden' : 'visible'}`}>
          <div className="date-info">
            <h3>{timetable.day}, {timetable.date}</h3>
            <div className="night-focus-badge">
              🌙 Tonight: <span>{timetable.night_focus}</span>
            </div>
          </div>
          
          <div className="schedule-timeline">
            <div className="timeline-block morning">
              <div className="block-header">
                <div className="block-icon">🌅</div>
                <div className="block-info">
                  <span className="block-title">Morning Focus</span>
                  <span className="block-time">7:30 - 12:00</span>
                </div>
              </div>
              <div className="block-activities">
                <EditableTimeBlock 
                  time="7:30" 
                  task={getTaskText("7:30", "Deep work session")} 
                  onSave={handleTaskEdit}
                />
                <EditableTimeBlock 
                  time="9:00" 
                  task={getTaskText("9:00", "Primary goal focus")} 
                  onSave={handleTaskEdit}
                />
                <EditableTimeBlock 
                  time="10:30" 
                  task={getTaskText("10:30", "Project development")} 
                  onSave={handleTaskEdit}
                />
              </div>
            </div>

            <div className="timeline-block afternoon">
              <div className="block-header">
                <div className="block-icon">☀️</div>
                <div className="block-info">
                  <span className="block-title">Afternoon Tasks</span>
                  <span className="block-time">12:00 - 17:00</span>
                </div>
              </div>
              <div className="block-activities">
                <EditableTimeBlock 
                  time="12:00" 
                  task={getTaskText("12:00", "Lunch & break")} 
                  onSave={handleTaskEdit}
                />
                <EditableTimeBlock 
                  time="14:00" 
                  task={getTaskText("14:00", "Admin & planning")} 
                  onSave={handleTaskEdit}
                />
                <EditableTimeBlock 
                  time="16:00" 
                  task={getTaskText("16:00", "Secondary tasks")} 
                  onSave={handleTaskEdit}
                />
              </div>
            </div>

            <div className="timeline-block evening">
              <div className="block-header">
                <div className="block-icon">🌆</div>
                <div className="block-info">
                  <span className="block-title">Personal Time</span>
                  <span className="block-time">17:00 - 21:00</span>
                </div>
              </div>
              <div className="block-activities">
                <EditableTimeBlock 
                  time="17:00" 
                  task={getTaskText("17:00", "Exercise & health")} 
                  onSave={handleTaskEdit}
                />
                <EditableTimeBlock 
                  time="19:00" 
                  task={getTaskText("19:00", "Dinner & family")} 
                  onSave={handleTaskEdit}
                />
                <EditableTimeBlock 
                  time="20:00" 
                  task={getTaskText("20:00", "Relaxation")} 
                  onSave={handleTaskEdit}
                />
              </div>
            </div>

            <div className="timeline-block night">
              <div className="block-header">
                <div className="block-icon">🌙</div>
                <div className="block-info">
                  <span className="block-title">{timetable.night_focus}</span>
                  <span className="block-time">21:00 - 00:30</span>
                </div>
              </div>
              <div className="block-activities">
                <EditableTimeBlock 
                  time="21:00" 
                  task={getTaskText("21:00", timetable.night_focus === "Side Hustle" ? "Personal projects" : "Wellness activities")} 
                  onSave={handleTaskEdit}
                />
                <EditableTimeBlock 
                  time="23:00" 
                  task={getTaskText("23:00", "Wind down routine")} 
                  onSave={handleTaskEdit}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={`logger-section ${showLogger ? 'visible' : 'hidden'}`}>
          <DailyLogger />
        </div>
      </div>
    </div>
  );
};

export default TimetableCard;