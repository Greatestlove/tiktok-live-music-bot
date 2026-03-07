const { WebcastPushConnection } = require('tiktok-live-connector');

// 1. 테스트할 틱톡 아이디 입력 (현재 라이브 중인 아무 유명인의 아이디로 테스트 가능)
// 예: '원정맨'이나 현재 라이브 탭에 떠 있는 아이디를 넣어보세요.
const TIKTOK_USERNAME = 'sweetie_hazelll';

// 2. 연결 설정
let tiktokLiveConnection = new WebcastPushConnection(TIKTOK_USERNAME);

// 3. 라이브 연결
tiktokLiveConnection.connect().then(state => {
    console.log(`✅ [연결 성공] 현재 방 ID: ${state.roomId}`);
    console.log(`채팅을 기다리는 중입니다... (채팅이 올라오면 화면에 표시됩니다)`);
}).catch(err => {
    console.error('❌ [연결 실패] 라이브 방송 중이 아니거나 아이디가 잘못되었습니다.', err);
});

// 4. 채팅 이벤트 수신
tiktokLiveConnection.on('chat', data => {
    // 틱톡 닉네임과 채팅 내용만 출력
    console.log(`[채팅] ${data.nickname}: ${data.comment}`);

    // 신청곡 명령어 테스트
    if (data.comment.startsWith('!신청곡')) {
        const songName = data.comment.replace('!신청곡', '').trim();
        console.log(`   🎵 신청곡 감지됨! -> 제목: [${songName}]`);
    }
});

// 5. 선물(풍선 등) 이벤트도 확인해보고 싶다면?
tiktokLiveConnection.on('gift', data => {
    console.log(`🎁 [선물] ${data.nickname}님이 ${data.giftName}을(를) 보냈습니다! (x${data.repeatCount})`);
});
