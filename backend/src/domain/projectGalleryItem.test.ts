import { describe, expect, test } from "bun:test";
import {
  buildGalleryVideoEmbedUrl,
  buildGalleryVideoPageUrl,
  MAX_GALLERY_TRACK_EVENTS,
  normalizeGalleryItemInput,
  normalizeGalleryItemPatch,
  normalizeGalleryOrderInput,
  normalizeGalleryTrackPayload,
  parseGalleryVideoRef,
} from "./projectGalleryItem";

const UUID_A = "11111111-2222-4333-8444-555555555555";
const UUID_B = "66666666-7777-4888-8999-aaaaaaaaaaaa";

describe("parseGalleryVideoRef", () => {
  test("接受 B 站标准播放页", () => {
    expect(parseGalleryVideoRef("https://www.bilibili.com/video/BV1xx411c7mD")).toEqual({
      provider: "bilibili",
      id: "BV1xx411c7mD",
    });
  });

  test("接受带 query 的 B 站链接并丢弃 query", () => {
    expect(parseGalleryVideoRef("https://www.bilibili.com/video/BV1xx411c7mD?p=2&t=30")).toEqual({
      provider: "bilibili",
      id: "BV1xx411c7mD",
    });
  });

  test("接受腾讯视频 page 与 cover 两种路径", () => {
    expect(parseGalleryVideoRef("https://v.qq.com/x/page/a1b2c3d4e5f.html")).toEqual({
      provider: "tencent",
      id: "a1b2c3d4e5f",
    });
    expect(parseGalleryVideoRef("https://v.qq.com/x/cover/mzc001/w3x9y8z7q6r.html")).toEqual({
      provider: "tencent",
      id: "w3x9y8z7q6r",
    });
  });

  test("接受优酷播放页", () => {
    expect(parseGalleryVideoRef("https://v.youku.com/v_show/id_XNTkzMzQ1Njc4OQ==.html")).toEqual({
      provider: "youku",
      id: "XNTkzMzQ1Njc4OQ==",
    });
  });

  // --- 对抗用例：这些必须全部拒绝 ---

  test("拒绝仿冒主机名（后缀匹配漏洞）", () => {
    expect(parseGalleryVideoRef("https://evil-bilibili.com/video/BV1xx411c7mD")).toBeNull();
    expect(parseGalleryVideoRef("https://bilibili.com.evil.io/video/BV1xx411c7mD")).toBeNull();
    expect(parseGalleryVideoRef("https://notv.qq.com/x/page/a1b2c3d4e5f.html")).toBeNull();
  });

  test("拒绝短链（无法预验目标）", () => {
    expect(parseGalleryVideoRef("https://b23.tv/abcdefg")).toBeNull();
  });

  test("拒绝非 https 协议", () => {
    expect(parseGalleryVideoRef("http://www.bilibili.com/video/BV1xx411c7mD")).toBeNull();
    expect(parseGalleryVideoRef("javascript:alert(1)")).toBeNull();
    expect(parseGalleryVideoRef("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
  });

  test("拒绝白名单站点但 ID 格式非法", () => {
    expect(parseGalleryVideoRef("https://www.bilibili.com/video/NOTABVID")).toBeNull();
    expect(parseGalleryVideoRef("https://www.bilibili.com/video/BV1xx411c7mD9999")).toBeNull();
    expect(parseGalleryVideoRef("https://www.bilibili.com/")).toBeNull();
  });

  test("拒绝空值与垃圾输入", () => {
    expect(parseGalleryVideoRef("")).toBeNull();
    expect(parseGalleryVideoRef(null)).toBeNull();
    expect(parseGalleryVideoRef(undefined)).toBeNull();
    expect(parseGalleryVideoRef("not a url")).toBeNull();
  });
});

describe("buildGalleryVideoEmbedUrl / PageUrl", () => {
  test("按模板拼装播放地址", () => {
    expect(buildGalleryVideoEmbedUrl("bilibili", "BV1xx411c7mD")).toBe(
      "https://player.bilibili.com/player.html?bvid=BV1xx411c7mD&autoplay=0&high_quality=1",
    );
    expect(buildGalleryVideoPageUrl("bilibili", "BV1xx411c7mD")).toBe(
      "https://www.bilibili.com/video/BV1xx411c7mD",
    );
  });

  test("ID 非法时返回空串，绝不拼出可用 src", () => {
    expect(buildGalleryVideoEmbedUrl("bilibili", '"><script>alert(1)</script>')).toBe("");
    expect(buildGalleryVideoEmbedUrl("", "BV1xx411c7mD")).toBe("");
    expect(buildGalleryVideoEmbedUrl("bilibili", "")).toBe("");
  });
});

describe("normalizeGalleryItemInput", () => {
  test("image 类型必须使用站内上传地址", () => {
    const good = normalizeGalleryItemInput({
      media_type: "image",
      image_url: "/api/uploads/objects/sha256/ab/cd/hash.webp",
      title: "主界面",
    });
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.value.image_url).toBe("/api/uploads/objects/sha256/ab/cd/hash.webp");

    expect(normalizeGalleryItemInput({ media_type: "image", image_url: "https://cdn.evil.com/x.png" }).ok).toBe(false);
    expect(normalizeGalleryItemInput({ media_type: "image", image_url: "/api/uploads/../secret.png" }).ok).toBe(false);
    expect(normalizeGalleryItemInput({ media_type: "image", image_url: "" }).ok).toBe(false);
  });

  test("text 类型至少需要标题或说明", () => {
    expect(normalizeGalleryItemInput({ media_type: "text", title: "全新版本" }).ok).toBe(true);
    expect(normalizeGalleryItemInput({ media_type: "text", caption: "支持多端同步" }).ok).toBe(true);
    expect(normalizeGalleryItemInput({ media_type: "text", title: "", caption: "" }).ok).toBe(false);
  });

  test("text 类型不携带图片与视频字段", () => {
    const res = normalizeGalleryItemInput({
      media_type: "text",
      title: "说明",
      image_url: "/api/uploads/objects/sha256/ab/cd/hash.webp",
      video_url: "https://www.bilibili.com/video/BV1xx411c7mD",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.image_url).toBe("");
      expect(res.value.video_provider).toBe("");
      expect(res.value.video_id).toBe("");
    }
  });

  test("video_embed 解析播放页 URL", () => {
    const res = normalizeGalleryItemInput({
      media_type: "video_embed",
      video_url: "https://www.bilibili.com/video/BV1xx411c7mD",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.video_provider).toBe("bilibili");
      expect(res.value.video_id).toBe("BV1xx411c7mD");
    }
  });

  test("video_embed 拒绝白名单外站点", () => {
    expect(
      normalizeGalleryItemInput({ media_type: "video_embed", video_url: "https://evil.com/v/1" }).ok,
    ).toBe(false);
  });

  test("media_type 非法直接拒绝", () => {
    expect(normalizeGalleryItemInput({ media_type: "iframe" }).ok).toBe(false);
    expect(normalizeGalleryItemInput({}).ok).toBe(false);
    expect(normalizeGalleryItemInput(null).ok).toBe(false);
  });

  test("跳转链接与关联项目互斥", () => {
    const res = normalizeGalleryItemInput({
      media_type: "text",
      title: "x",
      link_url: "https://example.com",
      linked_project_id: UUID_A,
    });
    expect(res.ok).toBe(false);
  });

  test("linked_project_id 必须是合法 UUID", () => {
    expect(normalizeGalleryItemInput({ media_type: "text", title: "x", linked_project_id: "abc" }).ok).toBe(false);
    const res = normalizeGalleryItemInput({ media_type: "text", title: "x", linked_project_id: UUID_A });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.linked_project_id).toBe(UUID_A);
  });

  test("sort_index 归一化与 clamp", () => {
    const cases: Array<[unknown, number]> = [
      ["abc", 0],
      [-5, 0],
      [3.7, 3],
      [999999, 9999],
      [undefined, 0],
    ];
    for (const [input, expected] of cases) {
      const res = normalizeGalleryItemInput({ media_type: "text", title: "x", sort_index: input });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value.sort_index).toBe(expected);
    }
  });

  test("is_enabled 默认 true，仅显式 false 关闭", () => {
    const on = normalizeGalleryItemInput({ media_type: "text", title: "x" });
    const off = normalizeGalleryItemInput({ media_type: "text", title: "x", is_enabled: false });
    expect(on.ok && on.value.is_enabled).toBe(true);
    expect(off.ok && off.value.is_enabled).toBe(false);
  });

  test("标题剔除控制字符并截断", () => {
    const res = normalizeGalleryItemInput({
      media_type: "text",
      title: "正常标题",
      caption: "x".repeat(1000),
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.caption.length).toBe(600);

    const bad = normalizeGalleryItemInput({ media_type: "text", title: "标题\x00注入" });
    expect(bad.ok).toBe(false); // title 被清空且 caption 为空 -> text 校验不过
  });
});

describe("normalizeGalleryItemPatch", () => {
  test("只处理出现过的键", () => {
    const res = normalizeGalleryItemPatch({ title: "新标题" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(Object.keys(res.value)).toEqual(["title"]);
      expect(res.value.title).toBe("新标题");
    }
  });

  test("出现 media_type 时走全量校验", () => {
    const res = normalizeGalleryItemPatch({ media_type: "image", image_url: "https://cdn.evil.com/x.png" });
    expect(res.ok).toBe(false);
  });

  test("link_url 允许显式清空", () => {
    const res = normalizeGalleryItemPatch({ link_url: "" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.link_url).toBe("");
  });

  test("link_url 非法直接拒绝", () => {
    expect(normalizeGalleryItemPatch({ link_url: "javascript:alert(1)" }).ok).toBe(false);
  });

  test("patch 内互斥同样生效", () => {
    expect(
      normalizeGalleryItemPatch({ link_url: "https://example.com", linked_project_id: UUID_A }).ok,
    ).toBe(false);
  });

  test("空 patch 返回空对象（由路由层判空）", () => {
    const res = normalizeGalleryItemPatch({});
    expect(res.ok).toBe(true);
    if (res.ok) expect(Object.keys(res.value).length).toBe(0);
  });
});

describe("normalizeGalleryOrderInput", () => {
  test("正常排序", () => {
    const res = normalizeGalleryOrderInput([
      { id: UUID_A, sort_index: 10 },
      { id: UUID_B, sort_index: 20 },
    ]);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toHaveLength(2);
  });

  test("去重保留首次出现", () => {
    const res = normalizeGalleryOrderInput([
      { id: UUID_A, sort_index: 10 },
      { id: UUID_A, sort_index: 99 },
    ]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toHaveLength(1);
      expect(res.value[0].sort_index).toBe(10);
    }
  });

  test("过滤非 UUID 条目", () => {
    const res = normalizeGalleryOrderInput([
      { id: "not-a-uuid", sort_index: 1 },
      { id: UUID_A, sort_index: 2 },
    ]);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toHaveLength(1);
  });

  test("非数组或全部非法时报错", () => {
    expect(normalizeGalleryOrderInput("nope").ok).toBe(false);
    expect(normalizeGalleryOrderInput([{ id: "x" }]).ok).toBe(false);
    expect(normalizeGalleryOrderInput([]).ok).toBe(false);
  });
});

describe("normalizeGalleryTrackPayload", () => {
  test("保留合法事件", () => {
    const res = normalizeGalleryTrackPayload([
      { itemId: UUID_A, type: "impression" },
      { item_id: UUID_B, type: "click" },
    ]);
    expect(res).toEqual([
      { itemId: UUID_A, type: "impression" },
      { itemId: UUID_B, type: "click" },
    ]);
  });

  test("静默丢弃非法项而不抛错", () => {
    expect(normalizeGalleryTrackPayload([{ itemId: "x", type: "impression" }])).toEqual([]);
    expect(normalizeGalleryTrackPayload([{ itemId: UUID_A, type: "hover" }])).toEqual([]);
    expect(normalizeGalleryTrackPayload("nope")).toEqual([]);
    expect(normalizeGalleryTrackPayload(null)).toEqual([]);
  });

  test("限制单次上报条数", () => {
    const many = Array.from({ length: 200 }, () => ({ itemId: UUID_A, type: "impression" }));
    expect(normalizeGalleryTrackPayload(many)).toHaveLength(MAX_GALLERY_TRACK_EVENTS);
  });
});
