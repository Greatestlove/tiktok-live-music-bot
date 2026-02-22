const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');
const yts = require('yt-search');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- 전역 변수 ---
let songQueue = [];
let isPlaying = false;
let tiktokConnection = null;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// [함수] 모든 상태를 초기화하는 함수
function resetSystem() {
    console.log('시스템 초기화: 대기열 및 재생 상태를 비웁니다.');
    songQueue = [];
    isPlaying = false;
    if (tiktokConnection) {
        try { tiktokConnection.disconnect(); } catch (e) { }
        tiktokConnection = null;
    }
    // 클라이언트들에게도 초기화 상태 알림
    io.emit('updateQueue', songQueue);
    io.emit('noMoreSongs');
}

io.on('connection', (socket) => {
    console.log('브라우저 연결됨');

    // [추가] 새로고침 대응: 페이지가 새로 연결되면 일단 서버 상태 초기화
    resetSystem();

    socket.on('connect-tiktok', (username) => {
        // [추가] 버튼을 다시 누를 경우 기존 상태 완전히 초기화
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

        tiktokConnection.on('chat', async (data) => {
            if (!isAcceptingRequests) return;

            if (data.comment.startsWith('!신청곡')) {
                const query = data.comment.replace('!신청곡', '').trim();
                if (!query) return;

                try {
                    const searchResult = await yts(query);
                    const video = searchResult.videos[0];

                    if (video) {
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

server.listen(3000, () => {
    console.log(`서버 실행: http://localhost:3000`);
});