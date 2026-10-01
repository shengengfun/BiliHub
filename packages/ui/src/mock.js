export const navTabs = ['直播', '推荐', '热门', '追番', '影视']

export const feedVideos = [
  { title: '看哪呢', up: '佑米UMe', play: '1.4万', danmaku: '6', duration: '0:10', badge: '6千点赞', ratio: '6 / 10', tone: 1 },
  { title: '你怎么知道鹮鸦一直是双休外设店？', up: 'TALONGAMES', play: '3612', danmaku: '-', duration: '0:27', ratio: '16 / 10', tone: 2 },
  { title: 'CS二级赛事新闻：Cadian高薪曝光 m0NESY再发TikTok Liquid…', up: '微辣加一点', play: '1万', danmaku: '-', duration: '8:46', ratio: '16 / 10', tone: 3 },
  { title: 'huge单排全是节目效果，误封等误解，菜🐔：🐔哥坐挂车', up: '山鸟与鱼不相遇', play: '1万', danmaku: '-', duration: '1:56', ratio: '16 / 10', tone: 4, following: true },
  { title: '彩虹六号一口气全新推出的三位日本干员，两位进攻方一位防守方…', up: '雷普中队淳平少佐', play: '1.2万', danmaku: '2', duration: '0:51', ratio: '16 / 9', tone: 5 },
  { title: 'Rush模式是如何实现每回合换出生点的？', up: '马膈', play: '2.3万', danmaku: '172', duration: '5:05', ratio: '16 / 9', tone: 6 },
  { title: '装一台2010年的ITX主机是种怎样体验？', up: '墨尘实验室', play: '4972', danmaku: '10', duration: '9:40', ratio: '16 / 9', tone: 7 },
  { title: '泰拉瑞亚 地牢守卫VS白天机械骷髅王', up: 'hahahahaMMJ', play: '1.9万', danmaku: '9', duration: '0:42', ratio: '16 / 9', tone: 8 },
]

export const dynamics = [
  {
    user: 'Team_Spirit', time: '8小时前', avatarTone: 3,
    text: 'EPL S24小组赛✌️',
    image: { caption: 'Schedule\nESL PRO LEAGUE S24', sub: '小组赛  赛制  BO3', rows: [['Falcons', 'TYLOO'], ['PARIVISION', 'Legacy'], ['Team Spirit', 'ShindeN'], ['Team Vitality', '1w Team']], times: ['17:00 星期六', '17:00 星期六', '19:30 星期六', '19:30 星期六'] },
  },
  {
    user: '幽灵大官人', time: '9小时前', avatarTone: 5,
    text: '这期讲一讲旧版本里那些被移除的机制，顺便回答下评论区的问题。',
    image: null,
  },
  {
    user: 'LinusTechTips', time: '昨天', avatarTone: 6,
    text: '我们把整台机器泡进了非导电液体里，结果比预期有意思。',
    image: null,
  },
]

export const dynamicUsers = [
  { name: '全部动态', tone: 0, all: true },
  { name: 'ywwuyi', tone: 2, live: true },
  { name: 'Team_Spirit', tone: 3 },
  { name: '幽灵大官人', tone: 5 },
  { name: '新鲜辣酱', tone: 4 },
  { name: 'Liyuu_', tone: 7 },
  { name: '影视飓风', tone: 8 },
  { name: 'LinusTechTips', tone: 6 },
  { name: '老张是大佬', tone: 1 },
]

// 菜单图标取自 iBiliPlayer-bili.apk 的 drawable/ic_mine_* 资源
export const mineMenus = [
  { group: '常用功能', items: [{ label: '常用功能', icon: 'ic-mine-common' }] },
  {
    group: '视频',
    items: [
      { label: '离线缓存', icon: 'ic-mine-offline' },
      { label: '历史记录', icon: 'ic-mine-history' },
      { label: '我的收藏', icon: 'ic-mine-favorite' },
      { label: '稍后再看', icon: 'ic-mine-watchlater' },
    ],
  },
  {
    group: '推荐服务',
    items: [
      { label: '我的关注', icon: 'ic-mine-common' },
      { label: '我的消息', icon: 'ic-notice' },
      { label: '我的课程', icon: 'ic-mine-mall' },
    ],
  },
  {
    group: '更多服务',
    items: [
      { label: '青少年模式', icon: 'ic-mine-theme' },
      { label: '我的客服', icon: 'ic-mine-feedback' },
      { label: '设置', icon: 'ic-mine-setting' },
    ],
  },
]

export const topIcons = ['ic-scan', 'ic-mine-history', 'ic-notice']

export const messageShortcuts = [
  { label: '回复我的', tone: '#00AEEC' },
  { label: '@我', tone: '#FFB027' },
  { label: '收到的赞', tone: '#FB7299' },
  { label: '系统通知', tone: '#2AC864' },
]

export const chatList = [
  { name: '844424930131965', desc: '贝壳收益到账成功', time: '00:51', tone: 0 },
  { name: 'UP主小助手', desc: '[有新通知]UP主荣誉周报', time: '09-29', unread: 4, tone: 1, badge: '助手' },
  { name: 'OurNotesOfficial', desc: '[有新通知]你订阅的游戏国际服公测开启！', time: '09-25', unread: 2, tone: 2, lv: 'LV6' },
  { name: '聖光Kiyoteru', desc: '后端有什么需求吗 可以考虑cf的serverless 如果不大的话', time: '09-24', tone: 3, lv: 'LV6' },
  { name: '小站助手', desc: '【前方高能】bilibili「小站」特邀你成为开荒元老', time: '09-21', tone: 4, lv: 'LV5' },
  { name: '电商带货小助手', desc: '带货邀约通知', time: '09-21', tone: 5, lv: 'LV4' },
  { name: '社区中心', desc: '', time: '09-20', tone: 6 },
]

export const settingsItems = [
  ['账号资料', '安全隐私', '播放设置', '离线设置'],
  ['推送设置', '消息设置', '深色设置', '清理存储空间'],
  ['其他设置', '我的客服', '用户协议'],
]

export const playerInfo = {
  up: '小鸡不好惹ooo', fans: '20.3万粉丝', videos: '60视频',
  title: '僵尸正在吃掉你的……',
  play: '6.1万', danmaku: '26', date: '2026年9月21日 23:14', watching: '1人正在看',
  actions: [
    { label: '1.6万', icon: '赞' },
    { label: '不喜欢', icon: '踩' },
    { label: '382', icon: '币' },
    { label: '7414', icon: '藏' },
    { label: '341', icon: '享' },
  ],
}

export const playerRecommends = [
  { title: '肥肥美美', up: '小鸡不好惹ooo', play: '7.2万', danmaku: '13', duration: '0:06', badge: '6千点赞', tone: 1 },
  { title: 'こういう服って好み分かれるよね', up: 'fuuka0020', play: '37.4万', danmaku: '88', duration: '0:33', badge: '8千点赞', tone: 2 },
  { title: '今天主播喝一个精品粥，粉丝先喝', up: '窝囊小苏', play: '32.8万', danmaku: '26', duration: '0:18', tone: 3 },
  { title: '酒醉身姿似百合花般', up: '四口一只兔 等联合创作', play: '13.5万', danmaku: '14', duration: '0:10', tone: 4 },
  { title: '节末抓紧补习作业', up: '是安然学姐吖', play: '44.8万', danmaku: '108', duration: '0:36', tone: 5 },
]
