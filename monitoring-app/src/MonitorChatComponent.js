// MonitorChatComponent.js untuk aplikasi Monitoring
import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, 
  Send, 
  X, 
  Users, 
  ChevronUp, 
  ChevronDown, 
  CheckCheck 
} from 'lucide-react';

// Komponen chat untuk aplikasi monitoring
const MonitorChatComponent = ({ socket, drivers, activeDriver, connected }) => {
  const [messages, setMessages] = useState({});
  const [newMessage, setNewMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const messagesEndRef = useRef(null);
  const [selectedDriver, setSelectedDriver] = useState(null);
  
  // Style untuk komponen chat dengan flat design
  const styles = {
    chatButton: {
      position: 'absolute',
      bottom: '16px',
      right: '16px',
      width: '50px',
      height: '50px',
      borderRadius: '50%',
      backgroundColor: '#3b82f6',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
      zIndex: 1000,
      border: 'none'
    },
    chatContainer: {
      position: 'absolute',
      bottom: minimized ? '80px' : '16px',
      right: '16px',
      width: '520px',
      height: minimized ? '60px' : '500px',
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      zIndex: 1000,
      transition: 'all 0.3s ease',
      transform: isOpen ? 'translateY(0)' : 'translateY(150%)',
      opacity: isOpen ? 1 : 0
    },
    header: {
      padding: '12px 16px',
      backgroundColor: '#3b82f6',
      color: 'white',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    title: {
      fontSize: '16px',
      fontWeight: 'bold',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    closeButton: {
      backgroundColor: 'transparent',
      border: 'none',
      color: 'white',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4px'
    },
    chatContent: {
      display: 'flex',
      flex: 1,
      overflow: 'hidden'
    },
    driverList: {
      width: '120px',
      borderRight: '1px solid #e2e8f0',
      overflow: 'auto',
      backgroundColor: '#f8fafc'
    },
    driverItem: (isActive) => ({
      padding: '12px',
      cursor: 'pointer',
      borderBottom: '1px solid #e2e8f0',
      backgroundColor: isActive ? '#3b82f6' : 'transparent',
      color: isActive ? 'white' : '#1e293b',
      fontWeight: isActive ? 'bold' : 'normal',
      position: 'relative'
    }),
    messageArea: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    },
    messagesContainer: {
      flex: 1,
      padding: '16px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      backgroundColor: '#f8fafc'
    },
    messageItem: (isMine) => ({
      padding: '10px 12px',
      borderRadius: '12px',
      maxWidth: '80%',
      wordBreak: 'break-word',
      alignSelf: isMine ? 'flex-end' : 'flex-start',
      backgroundColor: isMine ? '#3b82f6' : 'white',
      color: isMine ? 'white' : '#1e293b',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      border: isMine ? 'none' : '1px solid #e2e8f0'
    }),
    messageTime: (isMine) => ({
      fontSize: '10px',
      marginTop: '4px',
      color: isMine ? 'rgba(255,255,255,0.7)' : '#94a3b8',
      textAlign: isMine ? 'right' : 'left'
    }),
    inputContainer: {
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      borderTop: '1px solid #e2e8f0',
      backgroundColor: 'white',
      gap: '8px'
    },
    input: {
      flex: 1,
      padding: '10px 12px',
      border: '1px solid #e2e8f0',
      borderRadius: '24px',
      fontSize: '14px',
      outline: 'none',
      backgroundColor: '#f1f5f9'
    },
    sendButton: {
      width: '36px',
      height: '36px',
      borderRadius: '50%',
      backgroundColor: '#3b82f6',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: 'none',
      cursor: 'pointer'
    },
    disabledSendButton: {
      backgroundColor: '#94a3b8',
      cursor: 'not-allowed'
    },
    statusIndicator: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      backgroundColor: connected ? '#4ade80' : '#f87171', 
      marginRight: '6px'
    },
    unreadBadge: {
      position: 'absolute',
      top: '8px',
      right: '8px',
      backgroundColor: '#ef4444',
      color: 'white',
      borderRadius: '50%',
      fontSize: '10px',
      width: '16px',
      height: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 'bold',
    },
    minimizeButton: {
      marginLeft: '8px',
      backgroundColor: 'transparent',
      border: 'none',
      color: 'white',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    floatingBadge: {
      position: 'absolute',
      top: '-8px',
      right: '-8px',
      backgroundColor: '#ef4444',
      color: 'white',
      borderRadius: '50%',
      fontSize: '12px',
      width: '20px',
      height: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 'bold',
    },
    driverName: {
      fontSize: '14px',
      fontWeight: 'normal',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    readStatus: {
      fontSize: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '2px'
    }
  };
  
  // Effect untuk auto-scroll ke pesan terbaru
  useEffect(() => {
    if (messagesEndRef.current && isOpen && !minimized && selectedDriver) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, minimized, selectedDriver]);
  
  // Effect untuk menyiapkan socket listeners
  useEffect(() => {
    if (!socket) return;
    
    // Listener untuk pesan masuk
    const handleReceiveMessage = (data) => {
      // Pastikan pesan tidak duplikat dengan mengecek timestamp dan konten
      setMessages(prev => {
        const driverId = data.from === 'monitor' ? data.to : data.from;
        const driverMessages = prev[driverId] || [];
        
        // Cek apakah pesan sudah ada (duplikat)
        const isDuplicate = driverMessages.some(msg => 
          msg.timestamp === data.timestamp && 
          msg.text === data.text &&
          msg.from === data.from
        );
        
        // Jika duplikat, abaikan
        if (isDuplicate) return prev;
        
        // Tampilkan chat panel jika mendapat pesan baru dari driver yang belum terbuka chatnya
        if (!isOpen && data.from !== 'monitor') {
          setIsOpen(true);
          setMinimized(false);
          setSelectedDriver(driverId);
        }
        
        return {
          ...prev,
          [driverId]: [...driverMessages, data]
        };
      });
    };
    
    // Listener untuk pesan yang telah dibaca
    const handleMessageRead = (data) => {
      if (data.reader !== 'monitor') {
        setMessages(prev => {
          const driverId = data.reader;
          if (!prev[driverId]) return prev;
          
          return {
            ...prev,
            [driverId]: prev[driverId].map(msg => 
              data.messageIds.includes(msg.id) ? { ...msg, read: true } : msg
            )
          };
        });
      }
    };
    
    socket.on('receiveMessage', handleReceiveMessage);
    socket.on('messageRead', handleMessageRead);
    
    // Mengambil riwayat chat untuk semua driver
    const fetchAllChatHistories = async () => {
      // Penting: Pastikan mendapatkan semua driver, tidak hanya yang aktif
      socket.emit('getAllDrivers', {}, (response) => {
        if (response && response.drivers) {
          const allDriverIds = response.drivers;
          
          for (const driverId of allDriverIds) {
            // Request history untuk setiap driver
            socket.emit('getChatHistory', { driverId }, (response) => {
              if (response && response.messages && response.messages.length > 0) {
                setMessages(prev => ({
                  ...prev,
                  [driverId]: response.messages
                }));
              }
            });
          }
        }
      });
    };
    
    fetchAllChatHistories();
    
    return () => {
      socket.off('receiveMessage', handleReceiveMessage);
      socket.off('messageRead', handleMessageRead);
    };
  }, [socket, drivers]);
  
  // Effect untuk set driver yang aktif sebagai selected driver secara otomatis
  useEffect(() => {
    if (activeDriver && drivers[activeDriver]) {
      setSelectedDriver(activeDriver);
    } else if (Object.keys(drivers).length > 0 && !selectedDriver) {
      setSelectedDriver(Object.keys(drivers)[0]);
    } else {
      // Cari driver yang memiliki pesan meskipun tidak aktif
      const driversWithMessages = Object.keys(messages).filter(driverId => 
        messages[driverId] && messages[driverId].length > 0
      );
      
      if (driversWithMessages.length > 0 && !selectedDriver) {
        setSelectedDriver(driversWithMessages[0]);
      }
    }
  }, [activeDriver, drivers, selectedDriver, messages]);
  
  // Function untuk mengirim pesan
  const sendMessage = () => {
    if (!newMessage.trim() || !connected || !socket || !selectedDriver) return;
    
    const messageData = {
      text: newMessage.trim(),
      from: 'monitor', // Sender adalah monitor
      to: selectedDriver, // Penerima adalah driver yang dipilih
      timestamp: Date.now()
    };
    
    socket.emit('sendMessage', messageData);
    setNewMessage('');
  };
  
  // Handle input saat press enter
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };
  
  // Format waktu untuk tampilan pesan
  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Hitung total pesan yang belum dibaca dari semua driver
  const getTotalUnreadCount = () => {
    return Object.keys(messages).reduce((total, driverId) => {
      const unread = messages[driverId]?.filter(
        msg => msg.from !== 'monitor' && !msg.read
      ).length || 0;
      return total + unread;
    }, 0);
  };
  
  // Hitung jumlah pesan yang belum dibaca dari driver tertentu
  const getUnreadCountForDriver = (driverId) => {
    return messages[driverId]?.filter(
      msg => msg.from !== 'monitor' && !msg.read
    ).length || 0;
  };
  
  // Toggle chat panel
  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (minimized && isOpen) {
      setMinimized(false);
    }
  };
  
  // Toggle minimize chat panel
  const toggleMinimize = (e) => {
    e.stopPropagation();
    setMinimized(!minimized);
  };
  
  // Pilih driver untuk chat
  const selectDriver = (driverId) => {
    setSelectedDriver(driverId);
    
    // Tandai semua pesan dari driver ini sebagai telah dibaca
    if (socket && messages[driverId]) {
      const unreadIds = messages[driverId]
        .filter(msg => msg.from !== 'monitor' && !msg.read)
        .map(msg => msg.id);
      
      if (unreadIds.length > 0) {
        socket.emit('markAsRead', { messageIds: unreadIds, reader: 'monitor' });
        
        // Update state pesan lokal
        setMessages(prev => ({
          ...prev,
          [driverId]: prev[driverId].map(msg => 
            msg.from !== 'monitor' && !msg.read
              ? { ...msg, read: true }
              : msg
          )
        }));
      }
    }
  };
  
  return (
    <>
      {/* Tombol Chat */}
      <button 
        style={styles.chatButton} 
        onClick={toggleChat}
        aria-label="Toggle chat"
      >
        <MessageCircle size={24} />
        {!isOpen && getTotalUnreadCount() > 0 && (
          <div style={styles.floatingBadge}>
            {getTotalUnreadCount() > 9 ? '9+' : getTotalUnreadCount()}
          </div>
        )}
      </button>
      
      {/* Container Chat */}
      <div style={styles.chatContainer}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.title}>
            <div style={styles.statusIndicator}></div>
            {minimized 
              ? `Driver Chat ${getTotalUnreadCount() > 0 ? `(${getTotalUnreadCount()})` : ''}` 
              : selectedDriver 
                ? `Chat with: ${selectedDriver}` 
                : 'Driver Chat'
            }
          </div>
          <div style={{ display: 'flex' }}>
            <button 
              style={styles.minimizeButton} 
              onClick={toggleMinimize}
              aria-label={minimized ? "Maximize chat" : "Minimize chat"}
            >
              {minimized ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            <button 
              style={styles.closeButton} 
              onClick={toggleChat}
              aria-label="Close chat"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        
        {/* Chat Content - hanya ditampilkan jika tidak diminimalisir */}
        {!minimized && (
          <div style={styles.chatContent}>
            {/* Daftar Driver */}
            <div style={styles.driverList} className="custom-scrollbar">
              {/* Tampilkan semua driver yang memiliki pesan, termasuk yang tidak aktif */}
              {Object.keys(messages).length === 0 ? (
                <div style={{ padding: '12px', color: '#94a3b8', textAlign: 'center' }}>
                  Tidak ada driver aktif
                </div>
              ) : (
                Object.keys(messages).map((driverId) => {
                  const unreadCount = getUnreadCountForDriver(driverId);
                  const isActive = drivers[driverId] !== undefined;
                  
                  // Hanya tampilkan driver yang memiliki pesan
                  if (messages[driverId]?.length === 0) return null;
                  
                  return (
                    <div 
                      key={driverId}
                      style={{
                        ...styles.driverItem(selectedDriver === driverId),
                        opacity: isActive ? 1 : 0.7,
                      }}
                      onClick={() => selectDriver(driverId)}
                    >
                      <div style={styles.driverName}>
                        {driverId} {!isActive && '(offline)'}
                      </div>
                      {unreadCount > 0 && (
                        <div style={styles.unreadBadge}>
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </div>
                      )}
                    </div>
                  );
                }).filter(Boolean) // Filter null elements
              )}
            </div>
            
            {/* Area Pesan */}
            <div style={styles.messageArea}>
              {/* Daftar Pesan */}
              <div style={styles.messagesContainer} className="custom-scrollbar">
                {!selectedDriver ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '20px', fontSize: '14px' }}>
                    Pilih driver untuk mulai chat
                  </div>
                ) : !messages[selectedDriver] || messages[selectedDriver].length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '20px', fontSize: '14px' }}>
                    Belum ada pesan dengan {selectedDriver}. Mulai chat dengan mengirim pesan.
                  </div>
                ) : (
                  messages[selectedDriver].map((message, index) => {
                    const isMine = message.from === 'monitor';
                    return (
                      <div key={index} style={styles.messageItem(isMine)}>
                        <div>{message.text}</div>
                        <div style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', alignItems: 'center' }}>
                          <div style={styles.messageTime(isMine)}>
                            {formatMessageTime(message.timestamp)}
                          </div>
                          {isMine && (
                            <div style={{ 
                              color: message.read ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)', 
                              display: 'inline-flex',
                              marginLeft: '5px'
                            }}>
                              <CheckCheck size={12} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Input Pesan */}
              {selectedDriver && (
                <div style={styles.inputContainer}>
                  <input
                    style={styles.input}
                    type="text"
                    placeholder={`Ketik pesan untuk ${selectedDriver}...`}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={!connected}
                  />
                  <button 
                    style={{
                      ...styles.sendButton,
                      ...((!connected || !newMessage.trim()) && styles.disabledSendButton)
                    }} 
                    onClick={sendMessage}
                    disabled={!connected || !newMessage.trim()}
                  >
                    <Send size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default MonitorChatComponent;