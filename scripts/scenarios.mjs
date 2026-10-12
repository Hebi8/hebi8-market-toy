// The replay scenarios. Times are UTC. `from`–`to` is the part that is played;
// the bars between `context` and `from` are on the chart when a round starts.
//
// Dates and windows were set after looking at the downloaded minutes
// (`node scripts/inspect-days.mjs <first day> <last day>`), not from memory.
// `date` is the day of the event in the timezone the game shows (UTC+8).
// A round never starts on the first bar after a weekend: the gap belongs to
// the context, so nobody can trade it at Friday's price.
//
// `anchor` is a minute known from the reports of the day (an intervention, an
// announcement). The sharpest USD/JPY minute within three hours of it has to
// fall on it, which ties the timestamps of that file to the real clock.
export const PAIRS = ["USDJPY", "EURJPY", "AUDJPY"];

export const SCENARIOS = [
  {
    id: "2008-10-24-lehman",
    date: "2008-10-24",
    title: "雷曼之后的日元暴涨",
    blurb: "金融危机里套息交易集中平仓，日元对各货币全线急升，澳元兑日元一天的振幅超过一成。",
    context: "2008-10-23T04:00Z",
    from: "2008-10-24T04:00Z",
    to: "2008-10-24T14:00Z",
  },
  {
    id: "2011-03-17-record-high",
    date: "2011-03-17",
    title: "震后日元创战后新高",
    blurb: "东日本大地震后第六天，纽约收盘后的清淡时段里，美元兑日元一个小时跌掉三日元多，跌破 1995 年的纪录低点。",
    context: "2011-03-15T16:00Z",
    from: "2011-03-16T16:00Z",
    to: "2011-03-17T02:00Z",
  },
  {
    id: "2011-10-31-intervention",
    date: "2011-10-31",
    title: "日本单独干预",
    blurb: "美元兑日元刚创下 75 日元附近的纪录低点，日本财务省入市抛售日元，几分钟内拉升两日元。",
    context: "2011-10-28T00:00Z",
    from: "2011-10-30T22:00Z",
    to: "2011-10-31T08:00Z",
    anchor: "2011-10-31T01:25Z",
  },
  {
    id: "2013-04-04-qqe",
    date: "2013-04-04",
    title: "日银“异次元宽松”",
    blurb: "黑田东彦上任后的第一次议息，宣布两年内把基础货币翻倍，日元应声大跌。",
    context: "2013-04-03T02:00Z",
    from: "2013-04-04T02:00Z",
    to: "2013-04-04T12:00Z",
    anchor: "2013-04-04T04:40Z",
  },
  {
    id: "2015-08-24-flash-crash",
    date: "2015-08-24",
    title: "全球股市闪崩",
    blurb: "中国股市大跌引发全球抛售，美股开盘前美元兑日元两分钟里跌掉两日元多。",
    context: "2015-08-21T00:00Z",
    from: "2015-08-24T07:00Z",
    to: "2015-08-24T17:00Z",
    anchor: "2015-08-24T13:10Z",
  },
  {
    id: "2016-06-24-brexit",
    date: "2016-06-24",
    title: "英国脱欧公投",
    blurb: "计票结果一步步倒向脱欧，避险买盘涌入日元，美元兑日元一度跌破 100。",
    context: "2016-06-22T21:00Z",
    from: "2016-06-23T21:00Z",
    to: "2016-06-24T07:00Z",
  },
  {
    id: "2016-11-09-us-election",
    date: "2016-11-09",
    title: "美国大选开票",
    blurb: "开票过程中特朗普意外领先，日元先被抢购，随后行情又整个翻了回来。",
    context: "2016-11-08T00:00Z",
    from: "2016-11-09T00:00Z",
    to: "2016-11-09T10:00Z",
  },
  {
    id: "2019-01-03-flash-crash",
    date: "2019-01-03",
    title: "新年日元闪崩",
    blurb: "新年假期的清晨，一天里流动性最差的几分钟，日元对各货币瞬间飙升，澳元兑日元一度跌去约 7%。",
    context: "2019-01-01T18:00Z",
    from: "2019-01-02T18:00Z",
    to: "2019-01-03T04:00Z",
    anchor: "2019-01-02T22:35Z",
  },
  {
    id: "2020-03-09-covid-oil",
    date: "2020-03-09",
    title: "新冠恐慌与油价崩盘",
    blurb: "疫情扩散叠加原油价格战，周一早盘避险情绪爆发，美元兑日元跌到 101 附近。",
    context: "2020-03-06T00:00Z",
    from: "2020-03-08T22:00Z",
    to: "2020-03-09T08:00Z",
  },
  {
    id: "2022-09-22-intervention",
    date: "2022-09-22",
    title: "24 年来首次买入日元",
    blurb: "日银维持宽松后日元跌到 145.9，财务省随即入市，这是 1998 年以来日本第一次买入日元干预。",
    context: "2022-09-21T03:00Z",
    from: "2022-09-22T03:00Z",
    to: "2022-09-22T13:00Z",
    anchor: "2022-09-22T08:04Z",
  },
  {
    id: "2024-04-29-160",
    date: "2024-04-29",
    title: "160 关口与干预",
    blurb: "日本假日的清淡早盘，美元兑日元冲上 160，午后突然急跌，事后公布的数据证实是当局入市。",
    context: "2024-04-26T00:00Z",
    from: "2024-04-28T22:00Z",
    to: "2024-04-29T08:00Z",
    anchor: "2024-04-29T01:35Z",
  },
  {
    id: "2024-08-05-carry-unwind",
    date: "2024-08-05",
    title: "套息交易大平仓",
    blurb: "日银加息加上美国就业数据走弱，日元套息盘集中平仓，日经指数当天跌了四千多点。",
    context: "2024-08-02T00:00Z",
    from: "2024-08-04T22:00Z",
    to: "2024-08-05T08:00Z",
  },
];

export const seconds = (iso) => Date.parse(iso.replace("Z", ":00Z")) / 1000;

/** Every calendar year a scenario touches, context included. */
export function scenarioYears(scenario) {
  const years = [];
  for (let year = Number(scenario.context.slice(0, 4)); year <= Number(scenario.to.slice(0, 4)); year++) years.push(String(year));
  return years;
}
