// ChatComponent.js untuk aplikasi Driver
import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, X, ChevronUp, ChevronDown } from 'lucide-react';

// Komponen chat untuk aplikasi driver
const ChatComponent = ({ socket, driverId, connected }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const messagesEndRef = useRef(null);
  
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
    minimizedButton: {
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
      border: 'none',
      transform: 'scale(0.85)',
      transition: 'all 0.3s ease'
    },
    chatContainer: {
      position: 'absolute',
      bottom: '16px',
      right: '16px',
      width: '320px',
      height: '400px',
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      zIndex: 1000,
      transition: 'all 0.3s ease',
      transform: isOpen && !minimized ? 'translateY(0)' : 'translateY(150%)',
      opacity: isOpen && !minimized ? 1 : 0
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
      top: '-5px',
      right: '-5px',
      backgroundColor: '#ef4444',
      color: 'white',
      borderRadius: '50%',
      fontSize: '12px',
      width: '18px',
      height: '18px',
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
    }
  };
  
  // Effect untuk auto-scroll ke pesan terbaru
  useEffect(() => {
    if (messagesEndRef.current && isOpen && !minimized) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, minimized]);
  
  // Effect untuk menyiapkan socket listeners
  useEffect(() => {
    if (!socket) return;
    
    // Listener untuk pesan masuk
    const handleReceiveMessage = (data) => {
      // Only add messages for this driver
      if (data.to === driverId || data.from === driverId) {
        setMessages(prev => {
          // Cek apakah pesan dengan timestamp yang sama sudah ada
          const isDuplicate = prev.some(msg => 
            msg.timestamp === data.timestamp && 
            msg.from === data.from && 
            msg.text === data.text
          );
          
          // Jika duplikat, jangan tambahkan ke state
          if (isDuplicate) return prev;
          
          return [...prev, data];
        });
      }
    };
    
    socket.on('receiveMessage', handleReceiveMessage);
    
    // Ambil riwayat chat saat pertama kali komponen dimuat
    socket.emit('getChatHistory', { driverId }, (response) => {
      if (response && response.messages) {
        setMessages(response.messages);
      }
    });
    
    return () => {
      socket.off('receiveMessage', handleReceiveMessage);
    };
  }, [socket, driverId]);
  
  // Function untuk mengirim pesan
  const sendMessage = () => {
    if (!newMessage.trim() || !connected || !socket) return;
    
    const messageData = {
      text: newMessage.trim(),
      from: driverId,
      to: 'monitor', // Tetapkan 'monitor' sebagai penerima pesan dari driver
      timestamp: Date.now(),
      id: `${driverId}-${Date.now()}` // Tambahkan ID unik untuk pesan
    };
    
    // Tambahkan pesan ke state terlebih dahulu untuk mencegah duplikasi
    setMessages(prev => [...prev, messageData]);
    
    // Gunakan timeout kecil untuk menghindari race condition
    setTimeout(() => {
      socket.emit('sendMessage', messageData);
    }, 10);
    
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
  
  // Hitung jumlah pesan yang belum dibaca dari monitor
  const unreadCount = messages.filter(msg => 
    msg.from === 'monitor' && !msg.read
  ).length;
  
  // Toggle chat panel
  const toggleChat = () => {
    if (minimized) {
      // Jika sudah diminimize, kembalikan ke keadaan terbuka
      setMinimized(false);
      return;
    }
    
    setIsOpen(!isOpen);
    
    // Jika panel dibuka, tandai semua pesan dari monitor sebagai telah dibaca
    if (!isOpen && socket && unreadCount > 0) {
      const unreadIds = messages
        .filter(msg => msg.from === 'monitor' && !msg.read)
        .map(msg => msg.id);
      
      if (unreadIds.length > 0) {
        socket.emit('markAsRead', { messageIds: unreadIds, reader: driverId });
        
        // Update state pesan lokal
        setMessages(prev => prev.map(msg => 
          msg.from === 'monitor' && !msg.read
            ? { ...msg, read: true }
            : msg
        ));
      }
    }
  };
  
  // Toggle minimize chat panel
  const toggleMinimize = (e) => {
    e.stopPropagation();
    setMinimized(!minimized);
  };
  
  return (
    <>
      {/* Tombol Chat (hanya tampil jika chat tidak terbuka) */}
      {!isOpen && (
        <button 
          style={styles.chatButton} 
          onClick={toggleChat}
          aria-label="Toggle chat"
        >
          <MessageCircle size={24} />
          {unreadCount > 0 && (
            <div style={styles.unreadBadge}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </button>
      )}
      
      {/* Tombol Chat Diminimize (hanya tampil jika chat diminimize) */}
      {isOpen && minimized && (
        <button 
          style={styles.minimizedButton} 
          onClick={toggleChat}
          aria-label="Expand chat"
        >
          <MessageCircle size={24} />
          {unreadCount > 0 && (
            <div style={styles.unreadBadge}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </button>
      )}
      
      {/* Container Chat */}
      <div style={styles.chatContainer}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.title}>
            <div style={styles.statusIndicator}></div>
            Pusat Monitoring
            {unreadCount > 0 && <span style={{fontSize: '12px', marginLeft: '8px'}}>({unreadCount})</span>}
          </div>
          <div style={{ display: 'flex' }}>
            <button style={styles.minimizeButton} onClick={toggleMinimize}>
              <ChevronDown size={18} />
            </button>
            <button style={styles.closeButton} onClick={toggleChat}>
              <X size={18} />
            </button>
          </div>
        </div>
        
        {/* Daftar Pesan */}
        <div style={styles.messagesContainer} className="custom-scrollbar">
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '20px', fontSize: '14px' }}>
              Belum ada pesan. Mulai chat dengan mengirim pesan.
            </div>
          ) : (
            messages.map((message, index) => {
              const isMine = message.from === driverId;
              return (
                <div key={index} style={styles.messageItem(isMine)}>
                  <div>{message.text}</div>
                  <div style={styles.messageTime(isMine)}>
                    {formatMessageTime(message.timestamp)}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input Pesan */}
        <div style={styles.inputContainer}>
          <input
            style={styles.input}
            type="text"
            placeholder="Ketik pesan..."
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
      </div>
    </>
  );
};

export default ChatComponent;