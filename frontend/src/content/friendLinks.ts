export type FriendLink = {
  key: string;
  name: string;
  href: string;
  description: string;
  logo?: string;
};

export const friendLinks: FriendLink[] = [
  {
    key: 'hzzc',
    name: '汇智卓创',
    href: 'https://tjhzzc.cn',
    description: '天津静海汇智卓创文化发展有限公司官方网站。'
  },
  {
    key: 'zhijiaolianmeng',
    name: '智教联盟',
    href: 'https://forum.smart-teach.cn',
    description: '面向一线电教与教师的交流社区，分享工具、经验与问题解决方案。',
    logo: '/images/stcn.png'
  },
  {
    key: 'classisland',
    name: 'ClassIsland',
    href: 'https://classis.land',
    description: '跨平台的班级大屏课表软件，支持高度自定义与提醒功能。'
  },
  {
    key: 'classwidgets',
    name: 'Class Widgets',
    href: 'https://classwidgets.rinlit.cn',
    description: '桌面端课表与日程小组件，支持插件/主题定制与上下课提醒，覆盖 Windows/macOS/Linux。'
  },
  {
    key: 'cnel-elearning',
    name: 'CNEL 电教委员指南',
    href: 'https://cnel.smart-teach.cn',
    description: '面向电教委员的能力提升指南，涵盖电脑知识、设备操作与常见故障应对等内容。'
  },
  {
    key: 'inkore',
    name: 'iNKORE!',
    href: 'https://www.inkore.net',
    description: 'iNKORE Studios 官方网站，展示其项目与产品信息（含桌面应用与 UI 开发组件）。'
  },
  {
    key: 'awesome-class-softwares',
    name: 'Awesome-Class-Softwares',
    href: 'https://acs.jursin.top',
    description: '适用于班级一体机的优质软件合集（网页版）。'
  },
  {
    key: 'classisland-hub',
    name: 'ClassIsland Hub',
    href: 'https://hub.classisland.tech',
    description: '展示亿些 ClassIsland 交流群/频道里面的乐子。'
  },
  {
    key: 'rinlit-hub',
    name: 'RinlitHub',
    href: 'https://mcableblank.github.io/RinlitHub/',
    description: 'Class-Widgets 开发者的 Hub，收集 CW 交流群里面的乐子。'
  },
  {
    key: 'seewo-tutorial',
    name: '电教委入门指南',
    href: 'https://tutorial.misaka.space/',
    description: '从小白到高手，轻松玩转班级一体机。'
  },
  {
    key: 'seewogeekwiki',
    name: 'seewoGeekWiki',
    href: 'https://wiki.misaka.space/',
    description: '希沃业绩售后冲击部官方 Wiki。'
  },
  {
    key: 'seewo-tinkering-manual',
    name: '希沃折腾手册',
    href: 'https://7wdj.github.io/#/seewo',
    description: '希沃一体机折腾手册，整理了许多一体机折腾的教程。'
  },
  {
    key: 'houlang-cloud',
    name: '厚浪云',
    href: 'https://houlang.cloud/',
    description: '提供一系列开源产品与服务，包括二级域名分发、镜像站、班级大屏作业板等。'
  }
];
