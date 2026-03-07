const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');
const yts = require('yt-search');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let songQueue = [];
let isPlaying = false;
let tiktokConnection = null;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 시스템 초기화 함수
function resetSystem() {
    console.log('시스템 초기화 실행');
    songQueue = [];
    isPlaying = false;

    if (tiktokConnection) {
        // 기존에 등록된 모든 이벤트 리스너를 제거하여 중복 실행 방지
        tiktokConnection.removeAllListeners();
        try {
            tiktokConnection.disconnect();
        } catch (e) {
            console.error("연결 종료 중 오류:", e);
        }
        tiktokConnection = null;
    }

    io.emit('updateQueue', songQueue);
    io.emit('noMoreSongs');
}

io.on('connection', (socket) => {
    console.log('새로운 브라우저 연결됨');

    socket.on('connect-tiktok', (username) => {
        // [중요] 새로운 연결 시도 전 무조건 초기화
        resetSystem();

        let isAcceptingRequests = false;
        tiktokConnection = new WebcastPushConnection(username);

        tiktokConnection.connect()
            .then(state => {
                console.log(`[${username}] 연결 성공`);
                socket.emit('connection-success', { username });

                setTimeout(() => {
                    isAcceptingRequests = true;
                    socket.emit('status-update', '✅ 초기화 완료! 신청곡 접수 시작');
                }, 2000);
            })
            .catch(err => {
                socket.emit('connection-error', '방송 연결 실패');
            });

        // [핵심] 리스너를 등록하기 전에 혹시나 있을 중복 리스너 제거
        tiktokConnection.removeAllListeners('chat');

        tiktokConnection.on('chat', async (data) => {
            // 모든 채팅 소켓으로 전송 (UI 표시용)
            io.emit('chatMessage', {
                nickname: data.nickname,
                comment: data.comment
            });

            if (!isAcceptingRequests) return;

            // 신청곡 명령어 확인
            if (data.comment.startsWith('ㅋ')) {
                const query = data.comment.replace('ㅋ', '').trim();
                if (!query) return;

                console.log(`신청곡 감지: ${query}`);

                try {
                    const searchResult = await yts(query);
                    const video = searchResult.videos[0];

                    if (video) {
                        // 중복 곡 방지 로직 (선택 사항: 동일한 영상 ID가 대기열에 있는지 확인)
                        const isDuplicate = songQueue.some(s => s.videoId === video.videoId);
                        if (isDuplicate) {
                            console.log("이미 대기열에 있는 곡입니다.");
                            return;
                        }

                        const songData = {
                            title: video.title,
                            videoId: video.videoId,
                            requestedBy: data.nickname
                        };

                        songQueue.push(songData);
                        io.emit('updateQueue', songQueue);

                        if (!isPlaying) {
                            playNext();
                        }
                    }
                } catch (err) {
                    console.error('검색 오류');
                }
            }
        });
    });

    socket.on('songEnded', () => {
        playNext();
    });
});

function playNext() {
    if (songQueue.length > 0) {
        const nextSong = songQueue.shift();
        isPlaying = true;
        io.emit('playSong', nextSong);
        io.emit('updateQueue', songQueue);
    } else {
        isPlaying = false;
        io.emit('noMoreSongs');
    }
}

// Render 배포 시 포트 설정 (Render는 환경변수 PORT를 사용함)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 작동 중입니다.`);
});
