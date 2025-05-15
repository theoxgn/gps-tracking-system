// styles.js - Extracted styles to keep components clean
const styles = {
    container: {
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      position: 'relative',
      '@media (max-width: 768px)': {
        flexDirection: 'column'
      }
    },
    sidebar: {
      width: '320px',
      backgroundColor: '#f8fafc',
      color: '#334155',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid #e2e8f0',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
      '@media (max-width: 768px)': {
        width: '100%',
        height: '50%',
        borderRight: 'none',
        borderBottom: '1px solid #e2e8f0'
      }
    },
    header: {
      backgroundColor: '#3b82f6',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    },
    headerTitle: {
      fontSize: '20px',
      fontWeight: '700',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '8px',
      color: 'white'
    },
    headerIcon: {
      color: 'white'
    },
    statusBadge: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: '12px',
      color: 'rgba(255, 255, 255, 0.9)'
    },
    content: {
      flex: '1',
      padding: '16px',
      backgroundColor: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto'
    },
    sectionTitle: {
      fontSize: '16px',
      fontWeight: '600',
      marginBottom: '12px',
      color: '#3b82f6',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      borderBottom: '1px solid #e2e8f0',
      paddingBottom: '8px'
    },
    card: {
      padding: '16px',
      backgroundColor: '#f1f5f9',
      borderRadius: '8px',
      marginBottom: '12px',
      transition: 'all 0.2s ease',
      cursor: 'pointer',
      border: '1px solid #e2e8f0'
    },
    cardActive: {
      backgroundColor: '#3b82f6',
      color: 'white',
      borderColor: '#3b82f6'
    },
    cardHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    cardTitle: {
      fontWeight: 'bold',
      fontSize: '16px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    },
    cardTime: {
      fontSize: '12px',
      color: '#64748b',
      display: 'flex', 
      alignItems: 'center',
      gap: '4px'
    },
    cardGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '8px',
      marginTop: '8px',
      fontSize: '12px',
      color: '#475569'
    },
    infoItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    },
    infoIcon: {
      color: '#3b82f6'
    },
    controlsSection: {
      padding: '16px',
      backgroundColor: '#f8fafc',
      borderTop: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    },
    inputGroup: {
      marginBottom: '12px'
    },
    input: {
      width: '100%',
      padding: '12px',
      backgroundColor: '#ffffff',
      color: '#334155',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      marginBottom: '12px',
      fontSize: '14px',
      transition: 'border-color 0.2s ease',
      '&:focus': {
        borderColor: '#3b82f6',
        outline: 'none'
      }
    },
    button: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      padding: '12px',
      backgroundColor: '#3b82f6',
      color: 'white',
      fontWeight: '600',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
      gap: '8px',
      fontSize: '16px'
    },
    buttonRed: {
      backgroundColor: '#ef4444'
    },
    buttonHover: {
      backgroundColor: '#2563eb'
    },
    buttonRedHover: {
      backgroundColor: '#dc2626'
    },
    mapContainer: {
      flex: '1',
      position: 'relative',
      '@media (max-width: 768px)': {
        height: '50%'
      }
    },
    statusInfo: {
      marginTop: '12px',
      marginBottom: '16px'
    },
    errorBox: {
      backgroundColor: '#fee2e2',
      padding: '12px',
      borderRadius: '8px',
      marginBottom: '16px',
      border: '1px solid #fecaca'
    },
    errorTitle: {
      fontWeight: 'bold',
      color: '#ef4444'
    },
    errorText: {
      color: '#ef4444',
      fontSize: '14px'
    },
    statusBadgeActive: {
      display: 'inline-flex',
      alignItems: 'center',
      backgroundColor: '#dcfce7',
      padding: '6px 10px',
      borderRadius: '6px',
      fontSize: '12px',
      color: '#10b981'
    },
    statusBadgeInactive: {
      display: 'inline-flex',
      alignItems: 'center',
      backgroundColor: '#f1f5f9',
      padding: '6px 10px',
      borderRadius: '6px',
      fontSize: '12px',
      color: '#64748b'
    },
    statusDotActive: {
      color: '#10b981'
    },
    statusDotInactive: {
      color: '#64748b'
    },
    statusDetail: {
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: '12px',
      fontSize: '14px'
    },
    statusLabel: {
      color: '#3b82f6',
      marginBottom: '4px'
    },
    scrollbar: {
      scrollbarWidth: 'thin',
      scrollbarColor: '#cbd5e1 #f1f5f9'
    }
  };
  
  export { styles };