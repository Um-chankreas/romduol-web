<template>
  <div class="live-stream-container">
    <!-- Header -->
    <div class="header">
      <h1>🎥 Live Stream Class</h1>
      <div class="connection-status" :class="isConnected ? 'connected' : 'disconnected'">
        {{ isConnected ? 'Connected' : 'Disconnected' }}
      </div>
    </div>
 
    <!-- Settings Panel -->
    <div class="settings-panel" v-if="!isConnected">
      <div class="input-group">
        <label>Channel Name:</label>
        <input v-model="channelName" type="text" placeholder="Enter channel name" />
      </div>
      
      <div class="input-group">
        <label>Your Name:</label>
        <input v-model="userName" type="text" placeholder="Enter your name" />
      </div>
 
      <div class="input-group">
        <label>App ID:</label>
        <input v-model="appId" type="text" placeholder="Enter your Agora App ID" />
      </div>
 
      <div class="input-group">
        <label>Token (Optional - for production):</label>
        <input v-model="token" type="password" placeholder="Paste token here if you have one" />
        <small style="color: #666; margin-top: 5px; display: block;">
          💡 Leave empty for development with temporary token enabled
        </small>
      </div>
 
      <button class="btn-join" @click="joinChannel">
        Join Channel
      </button>
 
      <div class="help-text">
        <small>
          <strong>First time?</strong> See 
          <a href="QUICK_START.md" target="_blank">QUICK_START.md</a>
          or 
          <a href="FIX_TOKEN_ERROR.md" target="_blank">FIX_TOKEN_ERROR.md</a>
        </small>
      </div>
    </div>
 
    <!-- Video Grid -->
    <div class="video-grid" v-if="isConnected">
      <!-- Local Video -->
      <div class="video-container local">
        <div :id="`local-player-${uid}`" class="video-player"></div>
        <div class="user-label">You (Local)</div>
      </div>
 
      <!-- Remote Videos -->
      <div 
        v-for="user in remoteUsers" 
        :key="user.uid"
        class="video-container remote"
      >
        <div :id="`remote-player-${user.uid}`" class="video-player"></div>
        <div class="user-label">{{ user.name || `User ${user.uid}` }}</div>
      </div>
    </div>
 
    <!-- Controls -->
    <div class="controls" v-if="isConnected">
      <button 
        class="btn-control" 
        :class="{ active: audioEnabled }"
        @click="toggleAudio"
      >
        🎤 {{ audioEnabled ? 'Mute' : 'Unmute' }}
      </button>
 
      <button 
        class="btn-control" 
        :class="{ active: videoEnabled }"
        @click="toggleVideo"
      >
        📹 {{ videoEnabled ? 'Stop Video' : 'Start Video' }}
      </button>
 
      <button class="btn-leave" @click="leaveChannel">
        Leave Channel
      </button>
    </div>
 
    <!-- User List -->
    <div class="user-list" v-if="isConnected">
      <h3>Participants ({{ remoteUsers.length + 1 }})</h3>
      <div class="user-item">👤 {{ userName }} (You)</div>
      <div v-for="user in remoteUsers" :key="user.uid" class="user-item">
        👤 {{ user.name || `User ${user.uid}` }}
      </div>
    </div>
 
    <!-- Error Message -->
    <div class="error-message" v-if="error">
      ❌ {{ error }}
    </div>
  </div>
</template>
 
<script>
import AgoraRTC from 'agora-rtc-sdk-ng'
 
export default {
  name: 'AgoraLiveStream',
  data() {
    return {
      appId: '90f0e5a8c82643fcb78693895d820267', // Get from agora.io console
      token: '007eJxTYPDID18csCDln4yu0Z39XbXdple/PHynforF4EjwrSm2GskKDJYGaQappokWyRZGZibGaclJ5hZmlsYWlqYpFkYGRmbmRoodWQ2BjAx3xMOZGRkgEMQXZSjKT8kvzdHNySxL1U3OSSwu1k1JLWNgAAB78CS2', // Optional: for production
      channelName: 'rodoul-live-class-dev',
      userName: 'User_' + Math.floor(Math.random() * 1000),
      uid: Math.floor(Math.random() * 10000),
      
      // Connection state
      isConnected: false,
      audioEnabled: true,
      videoEnabled: true,
      error: null,
      
      // Agora objects
      agoraEngine: null,
      localAudioTrack: null,
      localVideoTrack: null,
      
      // Remote users
      remoteUsers: []
    }
  },
 
  methods: {
    async joinChannel() {
      try {
        this.error = null
        
        if (!this.appId) {
          this.error = 'Please enter your Agora App ID'
          return
        }
 
        if (!this.channelName) {
          this.error = 'Please enter a channel name'
          return
        }
 
        // Initialize Agora engine
        this.agoraEngine = AgoraRTC.createClient({
          mode: 'rtc',
          codec: 'vp9'
        })
 
        // Handle user published event
        this.agoraEngine.on('user-published', this.handleUserPublished)
        this.agoraEngine.on('user-unpublished', this.handleUserUnpublished)
        this.agoraEngine.on('user-left', this.handleUserLeft)
 
        // Join channel (using temp token - for development only)
        // In production, get token from your backend
        await this.agoraEngine.join(this.appId, this.channelName, this.token || null, this.uid)
 
        // Create and publish local tracks
        this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack()
        this.localVideoTrack = await AgoraRTC.createCameraVideoTrack()
 
        // Play local video
        await this.localVideoTrack.play(`local-player-${this.uid}`)
 
        // Publish tracks
        await this.agoraEngine.publish([this.localAudioTrack, this.localVideoTrack])
 
        this.isConnected = true
        console.log('✅ Joined channel successfully')
      } catch (err) {
        this.error = `Failed to join: ${err.message}`
        console.error('Join error:', err)
      }
    },
 
    async handleUserPublished(user, mediaType) {
      try {
        // Subscribe to remote user
        await this.agoraEngine.subscribe(user, mediaType)
 
        if (mediaType === 'video') {
          // Check if user already exists
          if (!this.remoteUsers.find(u => u.uid === user.uid)) {
            this.remoteUsers.push({
              uid: user.uid,
              name: `User ${user.uid}`,
              videoTrack: user.videoTrack
            })
          }
          
          // Play video after a small delay to ensure DOM is ready
          setTimeout(() => {
            user.videoTrack.play(`remote-player-${user.uid}`)
          }, 100)
        }
 
        if (mediaType === 'audio') {
          user.audioTrack.play()
        }
 
        console.log(`✅ Subscribed to user ${user.uid}`)
      } catch (err) {
        console.error('Subscribe error:', err)
      }
    },
 
    async handleUserUnpublished(user, mediaType) {
      console.log(`User ${user.uid} unpublished ${mediaType}`)
    },
 
    async handleUserLeft(user) {
      // Remove user from list
      this.remoteUsers = this.remoteUsers.filter(u => u.uid !== user.uid)
      console.log(`User ${user.uid} left`)
    },
 
    async toggleAudio() {
      try {
        if (this.localAudioTrack) {
          this.audioEnabled = !this.audioEnabled
          await this.localAudioTrack.setEnabled(this.audioEnabled)
        }
      } catch (err) {
        this.error = `Audio toggle error: ${err.message}`
      }
    },
 
    async toggleVideo() {
      try {
        if (this.localVideoTrack) {
          this.videoEnabled = !this.videoEnabled
          await this.localVideoTrack.setEnabled(this.videoEnabled)
        }
      } catch (err) {
        this.error = `Video toggle error: ${err.message}`
      }
    },
 
    async leaveChannel() {
      try {
        // Stop local tracks
        if (this.localAudioTrack) {
          await this.localAudioTrack.close()
        }
        if (this.localVideoTrack) {
          await this.localVideoTrack.close()
        }
 
        // Leave channel
        if (this.agoraEngine) {
          await this.agoraEngine.leave()
        }
 
        this.remoteUsers = []
        this.isConnected = false
        this.audioEnabled = true
        this.videoEnabled = true
        console.log('✅ Left channel successfully')
      } catch (err) {
        this.error = `Failed to leave: ${err.message}`
        console.error('Leave error:', err)
      }
    }
  },
 
  beforeUnmount() {
    this.leaveChannel()
  }
}
</script>
 
<style scoped>
.live-stream-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}
 
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  color: white;
}
 
.header h1 {
  margin: 0;
  font-size: 32px;
}
 
.connection-status {
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 14px;
}
 
.connection-status.connected {
  background-color: #4caf50;
  color: white;
}
 
.connection-status.disconnected {
  background-color: #f44336;
  color: white;
}
 
/* Settings Panel */
.settings-panel {
  background: white;
  padding: 30px;
  border-radius: 12px;
  margin-bottom: 30px;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}
 
.input-group {
  margin-bottom: 20px;
}
 
.input-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #333;
}
 
.input-group input {
  width: 100%;
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.3s;
}
 
.input-group input:focus {
  outline: none;
  border-color: #667eea;
}
 
.help-text {
  text-align: center;
  margin-top: 15px;
  color: #666;
}
 
.help-text small {
  display: inline-block;
}
 
.help-text a {
  color: #667eea;
  text-decoration: none;
  font-weight: 600;
}
 
.help-text a:hover {
  text-decoration: underline;
}
 
/* Buttons */
.btn-join, .btn-control, .btn-leave {
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}
 
.btn-join {
  width: 100%;
  background-color: #667eea;
  color: white;
  margin-top: 10px;
}
 
.btn-join:hover {
  background-color: #5568d3;
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(102, 126, 234, 0.4);
}
 
.btn-join:active {
  transform: translateY(0);
}
 
/* Video Grid */
.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}
 
.video-container {
  position: relative;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  aspect-ratio: 4 / 3;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}
 
.video-player {
  width: 100%;
  height: 100%;
  background-color: #1a1a1a;
}
 
.user-label {
  position: absolute;
  bottom: 12px;
  left: 12px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
}
 
.video-container.local {
  border: 3px solid #4caf50;
}
 
/* Controls */
.controls {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 30px;
  flex-wrap: wrap;
}
 
.btn-control {
  background-color: #4caf50;
  color: white;
}
 
.btn-control:hover {
  background-color: #45a049;
}
 
.btn-control.active {
  background-color: #4caf50;
  box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.3);
}
 
.btn-leave {
  background-color: #f44336;
  color: white;
}
 
.btn-leave:hover {
  background-color: #da190b;
}
 
/* User List */
.user-list {
  background: white;
  padding: 20px;
  border-radius: 12px;
  max-width: 300px;
  margin-left: auto;
  margin-right: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}
 
.user-list h3 {
  margin-top: 0;
  color: #333;
}
 
.user-item {
  padding: 10px;
  background: #f5f5f5;
  border-radius: 6px;
  margin-bottom: 8px;
  color: #333;
  font-size: 14px;
}
 
/* Error Message */
.error-message {
  background: #f44336;
  color: white;
  padding: 16px;
  border-radius: 6px;
  margin-bottom: 20px;
  text-align: center;
  font-weight: 600;
}
 
/* Responsive */
@media (max-width: 768px) {
  .live-stream-container {
    padding: 12px;
  }
 
  .header h1 {
    font-size: 24px;
  }
 
  .video-grid {
    grid-template-columns: 1fr;
  }
 
  .controls {
    flex-direction: column;
  }
 
  .btn-control, .btn-leave {
    width: 100%;
  }
}
</style>