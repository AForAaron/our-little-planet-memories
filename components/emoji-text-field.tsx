"use client";

import { Search, SmilePlus, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

const EMOJI_GROUPS = [
  {
    label: "常用",
    emojis: "😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😜 🤪 🤨 🧐 🤓 😎 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🤭 🫢 🫣 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕".split(" "),
  },
  {
    label: "爱心",
    emojis: "💕 💞 💓 💗 💖 💘 💝 💟 ❤️ 🧡 💛 💚 💙 💜 🤎 🖤 🤍 🩷 🩵 🩶 ❤️‍🔥 ❤️‍🩹 ❣️ 💔 💌 💋 🫶 🫰 🤲 🙌 👏 🤝 🙏".split(" "),
  },
  {
    label: "人物",
    emojis: "👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🦵 🦶 👂 👃 🧠 🫀 🫁 👀 👁️ 👅 👄 👶 🧒 👦 👧 🧑 👱 👨 👩 🧓 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🧏 🙇 🤦 🤷".split(" "),
  },
  {
    label: "自然",
    emojis: "🌱 🌿 🍃 🍀 🎋 🍂 🍁 🍄 🌾 💐 🌷 🌹 🥀 🪷 🌺 🌸 🌼 🌻 🌞 🌝 🌛 🌜 🌚 🌕 🌖 🌗 🌘 🌑 🌒 🌓 🌔 🌙 ⭐ 🌟 💫 ✨ ⚡ ☄️ 💥 🔥 🌈 ☀️ 🌤️ ⛅ 🌥️ ☁️ 🌦️ 🌧️ ⛈️ 🌩️ 🌨️ ❄️ ☃️ ⛄ 🌬️ 💨 🌪️ 🌫️ 🌊 💧 💦 ☔".split(" "),
  },
  {
    label: "动物",
    emojis: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐻‍❄️ 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐒 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🪱 🐛 🦋 🐌 🐞 🐜 🪰 🪲 🦟 🦗 🕷️ 🦂 🐢 🐍 🦎 🦖 🦕 🐙 🦑 🦐 🦞 🦀 🐡 🐠 🐟 🐬 🐳 🐋 🦈 🦭 🐊 🐅 🐆 🦓 🦍 🦧 🐘 🦛 🦏 🐪 🦒 🦘 🦬 🐃 🐂 🐄 🐎 🐖 🐏 🐑 🦙 🐐 🦌 🐕 🐩 🦮 🐈 🐈‍⬛ 🪶 🐾".split(" "),
  },
  {
    label: "食物",
    emojis: "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🫒 🥑 🍆 🥔 🥕 🌽 🌶️ 🫑 🥒 🥬 🥦 🧄 🧅 🍄 🥜 🫘 🌰 🍞 🥐 🥖 🫓 🥨 🥯 🥞 🧇 🧀 🍖 🍗 🥩 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🫔 🥙 🧆 🥚 🍳 🥘 🍲 🫕 🥣 🥗 🍿 🧈 🧂 🥫 🍱 🍘 🍙 🍚 🍛 🍜 🍝 🍠 🍢 🍣 🍤 🍥 🥮 🍡 🥟 🥠 🥡 🦪 🍦 🍧 🍨 🍩 🍪 🎂 🍰 🧁 🥧 🍫 🍬 🍭 🍮 🍯 🍼 🥛 ☕ 🍵 🧃 🥤 🧋 🍶 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🧉".split(" "),
  },
  {
    label: "地点",
    emojis: "🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🛵 🏍️ 🛺 🚲 🛴 🚏 🛣️ 🛤️ ⛽ 🚨 🚥 🚦 🛑 🚧 ⚓ ⛵ 🛶 🚤 🛳️ ⛴️ 🚢 ✈️ 🛩️ 🛫 🛬 🪂 💺 🚁 🚟 🚠 🚡 🛰️ 🚀 🛸 🧳 ⌛ ⏳ ⌚ ⏰ 🕰️ 🌍 🌎 🌏 🗺️ 🧭 🏔️ ⛰️ 🌋 🗻 🏕️ 🏖️ 🏜️ 🏝️ 🏞️ 🏟️ 🏛️ 🏗️ 🧱 🪨 🪵 🛖 🏘️ 🏚️ 🏠 🏡 🏢 🏣 🏤 🏥 🏦 🏨 🏩 🏪 🏫 🏬 🏭 🏯 🏰 💒 🗼 🗽 ⛪ 🕌 🛕 🕍 ⛩️ 🕋 ⛲ ⛺ 🌁 🌃 🏙️ 🌄 🌅 🌆 🌇 🌉 ♨️ 🎠 🛝 🎡 🎢 💈 🎪".split(" "),
  },
  {
    label: "活动",
    emojis: "⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🪀 🏓 🏸 🏒 🏑 🥍 🏏 🪃 🥅 ⛳ 🪁 🏹 🎣 🤿 🥊 🥋 🎽 🛹 🛼 🛷 ⛸️ 🥌 🎿 ⛷️ 🏂 🪂 🏋️ 🤼 🤸 ⛹️ 🤺 🤾 🏌️ 🏇 🧘 🏄 🏊 🤽 🚣 🧗 🚵 🚴 🏆 🥇 🥈 🥉 🏅 🎖️ 🏵️ 🎗️ 🎫 🎟️ 🎪 🎭 🩰 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🪘 🎷 🎺 🪗 🎸 🪕 🎻 🎲 ♟️ 🎯 🎳 🎮 🎰 🧩".split(" "),
  },
  {
    label: "物品",
    emojis: "⌚ 📱 📲 💻 ⌨️ 🖥️ 🖨️ 🖱️ 🖲️ 🕹️ 🗜️ 💽 💾 💿 📀 📼 📷 📸 📹 🎥 📽️ 🎞️ 📞 ☎️ 📟 📠 📺 📻 🎙️ 🎚️ 🎛️ 🧭 ⏱️ ⏲️ ⏰ 🕰️ 🧮 🔋 🪫 🔌 💡 🔦 🕯️ 🪔 🧯 🛢️ 💸 💵 💴 💶 💷 🪙 💰 💳 🧾 💎 ⚖️ 🪜 🧰 🪛 🔧 🔨 ⚒️ 🛠️ ⛏️ 🪚 🔩 ⚙️ 🪤 🧱 ⛓️ 🧲 🔫 💣 🧨 🪓 🔪 🗡️ 🛡️ 🚬 ⚰️ 🪦 ⚱️ 🏺 🔮 📿 🧿 🪬 💈 ⚗️ 🔭 🔬 🕳️ 🩹 🩺 💊 💉 🩸 🧬 🦠 🧫 🧪 🌡️ 🧹 🧺 🧻 🚽 🚰 🚿 🛁 🛀 🧼 🪥 🪒 🧽 🪣 🧴 🛎️ 🔑 🗝️ 🚪 🪑 🛋️ 🛏️ 🛌 🧸 🪆 🖼️ 🪞 🪟 🛍️ 🛒 🎁 🎈 🎏 🎀 🪄 🪅 🎊 🎉".split(" "),
  },
  {
    label: "符号",
    emojis: "✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ➗ ✖️ 🟰 💯 🔴 🟠 🟡 🟢 🔵 🟣 🟤 ⚫ ⚪ 🟥 🟧 🟨 🟩 🟦 🟪 🟫 ⬛ ⬜ 🔶 🔷 🔸 🔹 🔺 🔻 💠 🔘 🔳 🔲 ▪️ ▫️ ◾ ◽ ◼️ ◻️ 🟠 🧡 ♻️ ⚜️ 🔱 📛 🔰 ⭕ 🚫 ❗ ❕ ❓ ❔ ‼️ ⁉️ 🔅 🔆 〽️ ⚠️ 🚸 🔱 ⚕️ ♾️ ♻️ ©️ ®️ ™️ #️⃣ *️⃣ 0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟".split(" "),
  },
] as const;

const QUICK_EMOJIS = ["🌅", "🌊", "💕", "✨"];

type EmojiTextFieldProps = {
  as?: "input" | "textarea";
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  className?: string;
  emojis?: string[];
  quickEmojis?: string[];
  rows?: number;
};

export function EmojiTextField({
  as = "input",
  name,
  value,
  onChange,
  placeholder,
  maxLength,
  required,
  className = "",
  emojis,
  quickEmojis = QUICK_EMOJIS,
  rows,
}: EmojiTextFieldProps) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>(EMOJI_GROUPS[0].label);
  const [query, setQuery] = useState("");
  const quickList = emojis ?? quickEmojis;

  function insertEmoji(emoji: string) {
    const element = ref.current;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${emoji}${value.slice(end)}`;
    if (maxLength && next.length > maxLength) return;
    onChange(next);
    requestAnimationFrame(() => {
      const cursor = start + emoji.length;
      ref.current?.focus();
      ref.current?.setSelectionRange(cursor, cursor);
    });
  }

  const visibleEmojis = useMemo(() => {
    const normalized = query.trim();
    if (normalized) {
      return EMOJI_GROUPS.flatMap((group) => group.emojis).filter((emoji) => emoji.includes(normalized));
    }
    return EMOJI_GROUPS.find((group) => group.label === activeGroup)?.emojis ?? EMOJI_GROUPS[0].emojis;
  }, [activeGroup, query]);

  const fieldClassName = `field ${className}`.trim();
  return (
    <div className="emoji-field">
      {as === "textarea" ? (
        <textarea
          ref={(node) => {
            ref.current = node;
          }}
          className={fieldClassName}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          required={required}
          rows={rows}
        />
      ) : (
        <input
          ref={(node) => {
            ref.current = node;
          }}
          className={fieldClassName}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          required={required}
        />
      )}
      <div className="emoji-bar" aria-label="插入 emoji">
        {quickList.map((emoji) => (
          <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} aria-label={`插入 ${emoji}`}>
            {emoji}
          </button>
        ))}
        <button type="button" className="emoji-more-button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          <SmilePlus size={15} />
          <span>全部</span>
        </button>
      </div>
      {open && (
        <div className="emoji-picker" role="dialog" aria-label="全部 emoji">
          <div className="emoji-picker-head">
            <label className="emoji-search">
              <Search size={14} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="直接输入 emoji 搜索" />
            </label>
            <button type="button" onClick={() => setOpen(false)} aria-label="关闭 emoji 面板">
              <X size={15} />
            </button>
          </div>
          <div className="emoji-tabs" role="tablist" aria-label="Emoji 分类">
            {EMOJI_GROUPS.map((group) => (
              <button
                key={group.label}
                type="button"
                className={group.label === activeGroup && !query ? "is-active" : ""}
                onClick={() => {
                  setActiveGroup(group.label);
                  setQuery("");
                }}
              >
                {group.label}
              </button>
            ))}
          </div>
          <div className="emoji-grid">
            {visibleEmojis.map((emoji, index) => (
              <button key={`${emoji}-${index}`} type="button" onClick={() => insertEmoji(emoji)} aria-label={`插入 ${emoji}`}>
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
