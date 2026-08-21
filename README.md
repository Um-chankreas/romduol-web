# Agora Live Stream Web App - Setup Guide
 
## 🚀 Quick Start
 
### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Agora account (free)
### Installation Steps
 
#### 1. Clone or Navigate to Project
```bash
cd agora-live-stream
```
 
#### 2. Install Dependencies
```bash
npm install
```
 
#### 3. Get Your Agora App ID
 
1. Go to [Agora Console](https://console.agora.io)
2. Sign up for a **FREE** account
3. Click "Create" to create a new project
4. Copy your **App ID**
5. Paste it in the app when prompted (no credentials needed for testing)
#### 4. Run Development Server
```bash
npm run dev
```
 
You'll see:
```
VITE v4.x.x ready in xxx ms
 
➜  Local:   http://localhost:5173/
```
 
Open `http://localhost:5173/` in your browser!
 
---
 
## 🎮 How to Use the App
 
### Single Device Testing (One Tab)
1. Enter Channel Name: `test-channel`
2. Enter Your Name: `Teacher` (or any name)
3. Enter your Agora App ID
4. Click **"Join Channel"**
5. You'll see your camera feed
### Multi-Device Testing (Multiple Tabs/Devices)
1. **Tab 1 (Teacher):**
   - Channel: `test-channel`
   - Name: `Teacher`
   - Join
2. **Tab 2 (Student 1):**
   - Channel: `test-channel`
   - Name: `Student 1`
   - Join
3. **Tab 3 (Student 2):**
   - Channel: `test-channel`
   - Name: `Student 2`
   - Join
All participants will see each other's video!
 
---
 
## 🎯 Features Included
 
✅ **Video & Audio**
- Real-time video streaming
- Audio communication
- Mute/Unmute controls
- Stop/Start video
✅ **User Management**
- Participant list
- User naming
- Multiple concurrent users
✅ **UI/UX**
- Responsive design (mobile & desktop)
- Professional styling
- Connection status indicator
- Error handling
---
 
## 📁 Project Structure
 
```
agora-live-stream/
├── src/
│   ├── components/
│   │   └── AgoraLiveStream.vue    # Main live stream component
│   ├── App.vue                     # Root component
│   ├── main.js                     # Entry point
│   └── style.css                   # Global styles
├── index.html                      # HTML template
├── vite.config.js                  # Vite configuration
├── package.json                    # Dependencies
└── SETUP_GUIDE.md                  # This file
```
 
---
 
## 🔧 Available Commands
 
```bash
# Start development server
npm run dev
 
# Build for production
npm run build
 
# Preview production build
npm run preview
 
# List npm packages
npm list
```
 
---
 
## 🎬 Next Steps - Production Setup
 
### Important: For Production, You Need:
 
1. **Backend Server** (Node.js, Python, etc.)
   - Generate access tokens (security requirement)
   - Manage channel/room state
   - Authenticate users
2. **Token Generation**
   - Current setup uses `null` token (development only)
   - Production must use tokens from your backend
3. **Database**
   - Store user sessions
   - Track active channels
   - Keep call history
### Example Backend Token Generation (Node.js):
```javascript
const { RtcTokenBuilder, RtcRole } = require('agora-token');
 
const appId = 'your-app-id';
const appCertificate = 'your-app-certificate';
const channel = 'test-channel';
const uid = 12345;
const role = RtcRole.PUBLISHER;
const expirationTime = 3600;
 
const token = RtcTokenBuilder.buildTokenWithUid(
  appId,
  appCertificate,
  channel,
  uid,
  role,
  expirationTime
);
 
console.log(token);
```
 
---
 
## 🐛 Troubleshooting
 
### Camera/Microphone Access Denied
- Check browser permissions
- Allow camera/microphone in settings
- Try different browser (Chrome recommended)
### "Join Failed" Error
- Verify Agora App ID is correct
- Check internet connection
- Ensure channel name is entered
- Try different channel name
### No Remote Video Showing
- Wait 2-3 seconds for connection
- Check other user's video is enabled
- Refresh page and rejoin
### App Not Loading
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
npm run dev
```
 
---
 
## 📚 Useful Resources
 
- [Agora JavaScript SDK Docs](https://docs.agora.io/en/video-calling/get-started/get-started-sdk?platform=web)
- [Vue 3 Documentation](https://vuejs.org/)
- [Vite Documentation](https://vitejs.dev/)
---
 
## 🎓 Learning Path
 
### Week 1: Basic Setup ✓
- [x] Create Vue project
- [x] Install Agora SDK
- [x] Basic video streaming
- [x] Join/Leave functionality
### Week 2: Add Features
- [ ] Screen sharing
- [ ] Chat functionality
- [ ] User permissions
- [ ] Call recording
### Week 3: Polish
- [ ] Better UI/UX
- [ ] Mobile optimization
- [ ] Error handling
- [ ] Testing
### Week 4: Production
- [ ] Backend setup
- [ ] Token generation
- [ ] Database integration
- [ ] Deployment
---
 
## 💡 Tips & Tricks
 
1. **Test on Multiple Devices:**
   - Use laptop + phone
   - Use multiple browser tabs
   - Test on different networks
2. **Optimize Performance:**
   - Reduce video resolution on mobile
   - Limit participants (tested up to 10)
   - Use VP9 codec for better compression
3. **Debugging:**
   - Open browser DevTools (F12)
   - Check Console tab for errors
   - Monitor Network tab for connection
---
 
## 📝 License
This project is for educational purposes. Use Agora SDK according to their terms.
 
---
 
**Questions? Issues? Check Agora docs or ask in their community forum!**