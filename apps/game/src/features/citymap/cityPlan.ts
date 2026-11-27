// Dữ liệu bản đồ mở rộng — nguồn duy nhất cho `cityGen`.
//
// Vì sao là .ts chứ không phải .json: script kiểm toán (`scripts/city-audit.ts`) chạy bằng Node
// trực tiếp và Node đòi import attribute cho JSON; thêm nữa `satisfies CityPlan` bắt sai chính tả
// khoá/thiếu trường ngay lúc typecheck thay vì lúc runtime.
//
// Toạ độ: `anchors` là độ thật (WGS84) của mốc Sài Gòn 2026; `frame`, `tiles`, `points` là mét
// trong khung đã nén. Bắc = −z, đông = +x. Toạ độ gốc (0,0) là phòng 6.07 trong hẻm 462/14 Lý Thái Tổ.

export interface CityPlanAnchor {
  id: string;
  name: string;
  ward: string;
  lat: number;
  lon: number;
  heightM: number;
  footprintM: number;
  kind: string;
  year2026: string;
}

export interface CityPlanWater {
  id: string;
  name: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** `tiles` là [x0, z0, x1, z1] tính bằng mét — các mảng rời của một phường. */
export interface CityPlanDistrict {
  id: string;
  ward: string;
  old: string;
  tiles: number[][];
  character: string;
  story: string;
  verb: string;
  density: string;
  floors: [number, number];
  program: Record<string, number>;
}

export interface CityPlanAvenue {
  id: string;
  name: string;
  class: string;
  widthM: number;
  points: number[][];
}

/** `anchor` + `offset` (mét) đặt địa điểm vào đúng mốc thật. */
export interface CityPlanVenue {
  id: string;
  name: string;
  kind: string;
  anchor: string;
  offset: [number, number];
  story: string;
}

export interface CityPlanBeat {
  id: string;
  where: string[];
  verb: string;
  pressure: string;
}

export interface CityPlan {
  version: number;
  note: string;
  seed: string;
  compression: number;
  origin: { lat: number; lon: number; note: string };
  frame: { x0: number; x1: number; z0: number; z1: number };
  anchors: CityPlanAnchor[];
  water: CityPlanWater[];
  districts: CityPlanDistrict[];
  avenues: CityPlanAvenue[];
  venues: CityPlanVenue[];
  beats: CityPlanBeat[];
}

export const cityPlan: CityPlan = {
  version: 2,
  note: "Sài Gòn nén 1:8 — toạ độ thật của các mốc, chiếu về mét, bắc = -z, đông = +x. Khung 1220 x 790 m (0,96 km²), mục tiêu 0,35 km² đi được.",
  seed: "scammaze-saigon-2026",
  compression: 8,
  origin: {
    lat: 10.7665,
    lon: 106.672,
    note: "Hẻm 462/14 Lý Thái Tổ, phường Vườn Lài (Q10 cũ)"
  },
  frame: {
    x0: -420,
    x1: 800,
    z0: -470,
    z1: 320
  },
  anchors: [
    {
      id: "bitexco",
      name: "Bitexco Financial Tower",
      ward: "sai-gon",
      lat: 10.771888,
      lon: 106.704439,
      heightM: 262,
      footprintM: 34,
      kind: "tower",
      year2026: "2 Hải Triều, Phường Sài Gòn"
    },
    {
      id: "landmark81",
      name: "Landmark 81",
      ward: "thanh-my-tay",
      lat: 10.795,
      lon: 106.7218,
      heightM: 461,
      footprintM: 44,
      kind: "tower",
      year2026: "720A Điện Biên Phủ, Phường Thạnh Mỹ Tây"
    },
    {
      id: "ben-thanh",
      name: "Chợ Bến Thành",
      ward: "ben-thanh",
      lat: 10.7725,
      lon: 106.698,
      heightM: 14,
      footprintM: 60,
      kind: "market",
      year2026: "Phường Bến Thành"
    },
    {
      id: "binh-tay",
      name: "Chợ Bình Tây",
      ward: "cho-lon",
      lat: 10.7497,
      lon: 106.6519,
      heightM: 12,
      footprintM: 70,
      kind: "market",
      year2026: "Phường Chợ Lớn"
    },
    {
      id: "an-dong",
      name: "Chợ An Đông",
      ward: "an-dong",
      lat: 10.7567,
      lon: 106.671,
      heightM: 11,
      footprintM: 46,
      kind: "market",
      year2026: "Phường An Đông"
    },
    {
      id: "tao-dan",
      name: "Công viên Tao Đàn",
      ward: "ben-thanh",
      lat: 10.775,
      lon: 106.691,
      heightM: 0,
      footprintM: 180,
      kind: "park",
      year2026: "Phường Bến Thành"
    },
    {
      id: "metro-ben-thanh",
      name: "Ga Metro Bến Thành",
      ward: "ben-thanh",
      lat: 10.7714,
      lon: 106.6979,
      heightM: 8,
      footprintM: 40,
      kind: "metro",
      year2026: "Tuyến 1, ga ngầm"
    },
    {
      id: "metro-hoa-hung",
      name: "Ga Hòa Hưng (ST04)",
      ward: "hoa-hung",
      lat: 10.7632,
      lon: 106.6642,
      heightM: 0,
      footprintM: 90,
      kind: "metro-site",
      year2026: "Tuyến 2 Bến Thành–Tham Lương, khởi công 15/1/2026"
    },
    {
      id: "room",
      name: "Phòng 6.07",
      ward: "vuon-lai",
      lat: 10.7665,
      lon: 106.672,
      heightM: 12,
      footprintM: 8,
      kind: "home",
      year2026: "Hẻm 462/14 Lý Thái Tổ, Phường Vườn Lài"
    }
  ],
  water: [
    {
      id: "saigon-river",
      name: "Sông Sài Gòn",
      x0: 720,
      x1: 800,
      z0: -470,
      z1: 320
    },
    {
      id: "thi-nghe",
      name: "Kênh Thị Nghè",
      x0: 120,
      x1: 720,
      z0: -312,
      z1: -288
    }
  ],
  districts: [
    {
      id: "vuon-lai",
      ward: "Phường Vườn Lài",
      old: "Quận 10",
      tiles: [
        [
          -100,
          -470,
          120,
          110
        ]
      ],
      character: "hẻm 3 m, nhà trọ 12 m², tạp hoá, sửa xe, quán cóc; đây là nhà",
      story: "nơi bị lừa",
      verb: "trốn / nợ / gọi vay",
      density: "residential",
      floors: [
        2,
        5
      ],
      program: {
        shop: 14,
        food: 12,
        pawn: 1,
        repair: 4,
        boarding: 8,
        laundry: 3,
        net: 2
      }
    },
    {
      id: "hoa-hung",
      ward: "Phường Hòa Hưng",
      old: "Quận 10",
      tiles: [
        [
          -420,
          -470,
          -100,
          110
        ]
      ],
      character: "công trường metro 2, tường vây 41 m, rào tôn xanh, chung cư cũ, chợ nhỏ",
      story: "tiền chảy qua công trình",
      verb: "chui rào / bán hàng rong / hối lộ",
      density: "construction",
      floors: [
        3,
        7
      ],
      program: {
        shop: 8,
        food: 8,
        bank: 2,
        office: 3,
        gaming: 2,
        repair: 3
      }
    },
    {
      id: "cho-lon",
      ward: "Phường Chợ Lớn",
      old: "Quận 5",
      tiles: [
        [
          -420,
          110,
          -100,
          320
        ]
      ],
      character: "chợ Bình Tây, thuốc bắc, tiệm vàng, hẻm chợ 2,5 m, xe ba gác",
      story: "tiền mặt, vàng, cầm đồ",
      verb: "mặc cả / đổi tiền / cầm cố",
      density: "market",
      floors: [
        2,
        4
      ],
      program: {
        shop: 20,
        food: 16,
        gold: 5,
        pawn: 4,
        herb: 4,
        money: 3
      }
    },
    {
      id: "an-dong",
      ward: "Phường An Đông",
      old: "Quận 5",
      tiles: [
        [
          -100,
          110,
          120,
          320
        ]
      ],
      character: "chợ vải An Đông, sạp vải, may mặc, tiệm điện thoại cũ",
      story: "hàng hoá và tiền mặt",
      verb: "mua bán / đổi trả / cầm",
      density: "market",
      floors: [
        2,
        5
      ],
      program: {
        shop: 22,
        food: 12,
        pawn: 2,
        phone: 4,
        laundry: 4
      }
    },
    {
      id: "ben-thanh",
      ward: "Phường Bến Thành",
      old: "Quận 1",
      tiles: [
        [
          120,
          -288,
          400,
          320
        ]
      ],
      character: "chợ Bến Thành, ga metro 1, khách sạn, quán cà phê chuỗi, công viên Tao Đàn",
      story: "khách du lịch và tiền sạch",
      verb: "chụp ảnh / mua tour / đổi tiền",
      density: "tourist",
      floors: [
        4,
        12
      ],
      program: {
        cafe: 10,
        hotel: 6,
        shop: 12,
        food: 10,
        bank: 4,
        money: 3,
        office: 3
      }
    },
    {
      id: "sai-gon",
      ward: "Phường Sài Gòn",
      old: "Quận 1",
      tiles: [
        [
          400,
          -288,
          720,
          320
        ]
      ],
      character: "Bitexco, Nguyễn Huệ, ngân hàng, văn phòng kính, The Coffee House đóng cửa, cho thuê mặt bằng",
      story: "tiền được hợp pháp hoá",
      verb: "ký hợp đồng / mở công ty / rửa tiền",
      density: "corporate",
      floors: [
        6,
        22
      ],
      program: {
        bank: 8,
        office: 10,
        cafe: 8,
        shop: 10,
        food: 8,
        hotel: 3,
        money: 2
      }
    },
    {
      id: "thanh-my-tay",
      ward: "Phường Thạnh Mỹ Tây",
      old: "Quận Bình Thạnh",
      tiles: [
        [
          120,
          -470,
          720,
          -312
        ]
      ],
      character: "Landmark 81, Vinhomes Central Park, bến sông, cầu Thị Nghè, khu giàu",
      story: "đỉnh của thang tiền",
      verb: "gặp người giàu / bán dự án / bị tống tiền",
      density: "park",
      floors: [
        3,
        30
      ],
      program: {
        cafe: 8,
        shop: 8,
        food: 6,
        hotel: 2,
        office: 4,
        park: 6
      }
    }
  ],
  avenues: [
    {
      id: "ly-thai-to",
      name: "Lý Thái Tổ",
      class: "avenue",
      widthM: 20,
      points: [
        [
          0,
          -300
        ],
        [
          0,
          -160
        ],
        [
          0,
          0
        ],
        [
          0,
          160
        ],
        [
          0,
          300
        ]
      ]
    },
    {
      id: "dien-bien-phu",
      name: "Điện Biên Phủ",
      class: "avenue",
      widthM: 24,
      points: [
        [
          -420,
          60
        ],
        [
          -160,
          60
        ],
        [
          120,
          60
        ],
        [
          400,
          40
        ],
        [
          700,
          20
        ]
      ]
    },
    {
      id: "vo-van-kiet",
      name: "Võ Văn Kiệt",
      class: "avenue",
      widthM: 28,
      points: [
        [
          -420,
          -250
        ],
        [
          -120,
          -250
        ],
        [
          200,
          -250
        ],
        [
          520,
          -250
        ],
        [
          700,
          -250
        ]
      ]
    },
    {
      id: "tran-hung-dao",
      name: "Trần Hưng Đạo",
      class: "avenue",
      widthM: 20,
      points: [
        [
          -420,
          240
        ],
        [
          -160,
          220
        ],
        [
          60,
          190
        ],
        [
          300,
          170
        ]
      ]
    },
    {
      id: "le-hong-phong",
      name: "Lê Hồng Phong",
      class: "avenue",
      widthM: 18,
      points: [
        [
          -160,
          -300
        ],
        [
          -160,
          -100
        ],
        [
          -160,
          100
        ],
        [
          -160,
          300
        ]
      ]
    },
    {
      id: "nguyen-tri-phuong",
      name: "Nguyễn Tri Phương",
      class: "avenue",
      widthM: 18,
      points: [
        [
          -420,
          80
        ],
        [
          -260,
          60
        ],
        [
          -120,
          70
        ],
        [
          40,
          90
        ],
        [
          200,
          100
        ]
      ]
    },
    {
      id: "nguyen-hue",
      name: "Phố đi bộ Nguyễn Huệ",
      class: "pedestrian",
      widthM: 22,
      points: [
        [
          452,
          -140
        ],
        [
          452,
          -10
        ],
        [
          452,
          60
        ]
      ]
    },
    {
      id: "ton-duc-thang",
      name: "Tôn Đức Thắng",
      class: "avenue",
      widthM: 18,
      points: [
        [
          640,
          -280
        ],
        [
          660,
          -100
        ],
        [
          660,
          100
        ],
        [
          640,
          300
        ]
      ]
    },
    {
      id: "thi-nghe-bridge",
      name: "Cầu Thị Nghè",
      class: "bridge",
      widthM: 16,
      points: [
        [
          560,
          -270
        ],
        [
          560,
          -330
        ]
      ]
    },
    ],
  venues: [
    {
      id: "nha-tro",
      name: "Dãy trọ 462/14",
      kind: "boarding",
      anchor: "room",
      offset: [
        0,
        0
      ],
      story: "nơi bắt đầu"
    },
    {
      id: "tap-hoa-co-ba",
      name: "Tạp hoá Cô Ba",
      kind: "shop",
      anchor: "room",
      offset: [
        -28,
        12
      ],
      story: "bán SIM, thẻ cào"
    },
    {
      id: "sua-xe-chu-hai",
      name: "Sửa xe Chú Hai",
      kind: "repair",
      anchor: "room",
      offset: [
        24,
        18
      ],
      story: "nghe lỏm chuyện nợ"
    },
    {
      id: "cam-do-88",
      name: "Cầm đồ 88",
      kind: "pawn",
      anchor: "room",
      offset: [
        -52,
        -36
      ],
      story: "lãi cắt cổ"
    },
    {
      id: "quan-com-tam",
      name: "Cơm tấm Cô Tư",
      kind: "food",
      anchor: "room",
      offset: [
        34,
        -22
      ],
      story: "nghe chuyện trong hẻm"
    },
    {
      id: "tiem-vang-kim-phat",
      name: "Vàng Kim Phát",
      kind: "gold",
      anchor: "binh-tay",
      offset: [
        -36,
        -24
      ],
      story: "đổi tiền, vàng"
    },
    {
      id: "nha-thuoc-bac",
      name: "Thuốc bắc Hòa Bình",
      kind: "herb",
      anchor: "binh-tay",
      offset: [
        38,
        -18
      ],
      story: "chủ nợ lớn"
    },
    {
      id: "cho-binh-tay",
      name: "Chợ Bình Tây",
      kind: "market",
      anchor: "binh-tay",
      offset: [
        0,
        0
      ],
      story: "chợ đầu mối"
    },
    {
      id: "vang-an-dong",
      name: "Chợ vải An Đông",
      kind: "market",
      anchor: "an-dong",
      offset: [
        0,
        0
      ],
      story: "hàng thật, hoá đơn giả"
    },
    {
      id: "dien-thoai-cu-24h",
      name: "Điện thoại cũ 24h",
      kind: "phone",
      anchor: "an-dong",
      offset: [
        40,
        26
      ],
      story: "mua máy, bán máy"
    },
    {
      id: "cho-ben-thanh",
      name: "Chợ Bến Thành",
      kind: "market",
      anchor: "ben-thanh",
      offset: [
        0,
        0
      ],
      story: "du lịch, đổi tiền"
    },
    {
      id: "ga-metro-1",
      name: "Ga Metro Bến Thành",
      kind: "metro",
      anchor: "metro-ben-thanh",
      offset: [
        0,
        0
      ],
      story: "đi xa, trốn xa"
    },
    {
      id: "highlands-nguyen-hue",
      name: "Highlands Nguyễn Huệ",
      kind: "cafe",
      anchor: "bitexco",
      offset: [
        -40,
        26
      ],
      story: "gặp người tuyển dụng"
    },
    {
      id: "katinat-dong-khoi",
      name: "Katinat Đồng Khởi",
      kind: "cafe",
      anchor: "bitexco",
      offset: [
        46,
        40
      ],
      story: "chỗ hẹn của người giàu"
    },
    {
      id: "the-coffee-house-cu",
      name: "Mặt bằng TCH đóng cửa",
      kind: "office",
      anchor: "bitexco",
      offset: [
        -76,
        -18
      ],
      story: "mở văn phòng ảo"
    },
    {
      id: "bank-vietcombank-cn",
      name: "Vietcombank CN Sài Gòn",
      kind: "bank",
      anchor: "bitexco",
      offset: [
        64,
        -46
      ],
      story: "chuyển khoản, phong toả"
    },
    {
      id: "bitexco-tower",
      name: "Bitexco Financial Tower",
      kind: "tower",
      anchor: "bitexco",
      offset: [
        0,
        0
      ],
      story: "tầng 49, hợp đồng"
    },
    {
      id: "landmark81-tower",
      name: "Landmark 81",
      kind: "tower",
      anchor: "landmark81",
      offset: [
        0,
        0
      ],
      story: "đỉnh cao nhất, gặp trùm"
    },
    {
      id: "vinhomes-park",
      name: "Vinhomes Central Park",
      kind: "park",
      anchor: "landmark81",
      offset: [
        -120,
        40
      ],
      story: "đi dạo, bị theo dõi"
    },
    {
      id: "ben-saigon",
      name: "Bến sông Tôn Đức Thắng",
      kind: "pier",
      anchor: "bitexco",
      offset: [
        150,
        60
      ],
      story: "tẩu tán"
    },
    {
      id: "ga-hoa-hung",
      name: "Công trường ga Hòa Hưng",
      kind: "metro-site",
      anchor: "metro-hoa-hung",
      offset: [
        0,
        0
      ],
      story: "rào tôn, lối tắt, hối lộ"
    },
    {
      id: "chung-cu-hoa-hung",
      name: "Chung cư Hòa Hưng",
      kind: "apartment",
      anchor: "metro-hoa-hung",
      offset: [
        64,
        40
      ],
      story: "người quen cũ"
    },
    {
      id: "cong-vien-tao-dan",
      name: "Công viên Tao Đàn",
      kind: "park",
      anchor: "tao-dan",
      offset: [
        0,
        0
      ],
      story: "chỗ gặp kín"
    }
  ],
  beats: [
    {
      id: "hint",
      where: [
        "tap-hoa-co-ba",
        "quan-com-tam"
      ],
      verb: "nghe",
      pressure: "nợ"
    },
    {
      id: "cash-out",
      where: [
        "tiem-vang-kim-phat",
        "cho-binh-tay"
      ],
      verb: "đổi tiền",
      pressure: "tiền mặt"
    },
    {
      id: "fake-office",
      where: [
        "the-coffee-house-cu",
        "katinat-dong-khoi"
      ],
      verb: "ký",
      pressure: "uy tín"
    },
    {
      id: "transfer",
      where: [
        "bank-vietcombank-cn",
        "ga-metro-1"
      ],
      verb: "chuyển khoản",
      pressure: "phong toả"
    },
    {
      id: "site",
      where: [
        "ga-hoa-hung",
        "chung-cu-hoa-hung"
      ],
      verb: "chui rào",
      pressure: "giấy phép"
    },
    {
      id: "top",
      where: [
        "landmark81-tower",
        "vinhomes-park"
      ],
      verb: "gặp",
      pressure: "quyền lực"
    }
  ]
};
