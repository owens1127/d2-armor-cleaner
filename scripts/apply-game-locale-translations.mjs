/**
 * Applies game.json and duel compare label translations for all manifest locales.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, '..', 'src', 'locales');
const LOCALES = ['de', 'es', 'es-mx', 'fr', 'it', 'ja', 'ko', 'pl', 'pt-br', 'ru', 'zh-chs', 'zh-cht'];

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

/** @type {Record<string, { game: object; duel?: object }>} */
const PATCHES = {
  ko: {
    game: {
      classes: { titan: '타이탄', hunter: '사냥꾼', warlock: '워록' },
      stats: {
        weapons: '무기',
        grenade: '수류탄',
        super: '슈퍼',
        melee: '근접',
        health: '생명력',
        class: '클래스',
      },
      archetypes: {
        gunner: '거너',
        grenadier: '그레네이더',
        paragon: '패러곤',
        brawler: '브롤러',
        bulwark: '벌워크',
        specialist: '스페셜리스트',
      },
      slots: {
        helmet: '투구',
        arms: '팔',
        chest: '가슴',
        legs: '다리',
        classItem: '직업 아이템',
      },
      roll: {
        tertiary: '{{stat}} 3차',
        tuning: '{{stat}} 튜닝',
        tuningLabel: '튜닝: {{stat}}',
        preferred: '선호',
        none: '없음',
      },
      diff: {
        tuning: '튜닝',
        set: '세트',
        setFootnote: '세트: {{name}}',
        power: '전투력',
        masterwork: '마스터워크',
        noSet: '세트 없음',
        yes: '예',
        no: '아니오',
        tuningVs: '튜닝: {{a}} vs {{b}}',
      },
    },
    duel: {
      compare: {
        pass: '패스',
        preferred: '선호',
        tuningLabel: '튜닝: {{stat}}',
        setFootnote: '세트: {{name}}',
        loss_one: '1 패배',
        loss_other: '{{count}} 패배',
        lossRemaining_one: '버킷 종료 전 정크까지 {{count}}번 더 패배 필요',
        lossRemaining_other: '버킷 종료 전 정크까지 {{count}}번 더 패배 필요',
        keyboardHints:
          '버튼에 마우스를 올리면 결과 표시 · ↑ 둘 다 keep · Space 패스 · ↓ 둘 다 정크 · Ctrl+←/→ 측면 정크',
        aria: {
          keepLeft: '왼쪽 keep. {{outcome}}',
          keepRight: '오른쪽 keep. {{outcome}}',
          keepBoth: '둘 다 keep. {{outcome}}',
          preferLeft: '왼쪽 선호. {{outcome}}',
          preferRight: '오른쪽 선호. {{outcome}}',
          passPair: '패스. {{outcome}}',
          junkLeft: '왼쪽 정크. {{outcome}}',
          junkRight: '오른쪽 정크. {{outcome}}',
          junkBoth: '둘 다 정크. {{outcome}}',
        },
      },
      keyboard: {
        left: '왼쪽',
        both: '둘 다',
        right: '오른쪽',
        keep: 'Keep',
        prefer: '선호',
        junk: '정크',
      },
    },
  },
  de: {
    game: {
      classes: { titan: 'Titan', hunter: 'Jäger', warlock: 'Warlock' },
      stats: {
        weapons: 'Waffen',
        grenade: 'Granate',
        super: 'Super',
        melee: 'Nahkampf',
        health: 'Gesundheit',
        class: 'Klasse',
      },
      archetypes: {
        gunner: 'Schütze',
        grenadier: 'Grenadier',
        paragon: 'Vorbild',
        brawler: 'Schläger',
        bulwark: 'Bollwerk',
        specialist: 'Spezialist',
      },
      slots: {
        helmet: 'Helm',
        arms: 'Arme',
        chest: 'Brust',
        legs: 'Beine',
        classItem: 'Klassengegenstand',
      },
      roll: {
        tertiary: '{{stat}} Tertiär',
        tuning: '{{stat}} Abstimmung',
        tuningLabel: 'Abstimmung: {{stat}}',
        preferred: 'Bevorzugt',
        none: 'keine',
      },
      diff: {
        tuning: 'Abstimmung',
        set: 'Set',
        setFootnote: 'Set: {{name}}',
        power: 'Power',
        masterwork: 'Meisterwerk',
        noSet: 'Kein Set',
        yes: 'Ja',
        no: 'Nein',
        tuningVs: 'Abstimmung: {{a}} vs {{b}}',
      },
    },
    duel: {
      compare: {
        pass: 'Pass',
        preferred: 'Bevorzugt',
        tuningLabel: 'Abstimmung: {{stat}}',
        setFootnote: 'Set: {{name}}',
        loss_one: '1 Niederlage',
        loss_other: '{{count}} Niederlagen',
        lossRemaining_one: '{{count}} weitere Prefer-Niederlage bis Schrott am Bucket-Ende',
        lossRemaining_other: '{{count}} weitere Prefer-Niederlagen bis Schrott am Bucket-Ende',
        keyboardHints:
          'Buttons für Ergebnisse · ↑ beide behalten · Leertaste Pass · ↓ beide Schrott · Strg+←/→ Seiten-Schrott',
        aria: {
          keepLeft: 'Links behalten. {{outcome}}',
          keepRight: 'Rechts behalten. {{outcome}}',
          keepBoth: 'Beide behalten. {{outcome}}',
          preferLeft: 'Links bevorzugen. {{outcome}}',
          preferRight: 'Rechts bevorzugen. {{outcome}}',
          passPair: 'Paar passen. {{outcome}}',
          junkLeft: 'Links Schrott. {{outcome}}',
          junkRight: 'Rechts Schrott. {{outcome}}',
          junkBoth: 'Beide Schrott. {{outcome}}',
        },
      },
      keyboard: {
        left: 'Links',
        both: 'Beide',
        right: 'Rechts',
      },
    },
  },
  fr: {
    game: {
      classes: { titan: 'Titan', hunter: 'Chasseur', warlock: 'Arcaniste' },
      stats: {
        weapons: 'Armes',
        grenade: 'Grenade',
        super: 'Super',
        melee: 'Mêlée',
        health: 'Santé',
        class: 'Classe',
      },
      diff: {
        noSet: 'Pas de set',
        setFootnote: 'Set : {{name}}',
        tuningVs: 'Réglage : {{a}} vs {{b}}',
      },
    },
    duel: {
      keyboard: { left: 'Gauche', both: 'Les deux', right: 'Droite', pass: 'Passer' },
      compare: { pass: 'Passer', setFootnote: 'Set : {{name}}' },
    },
  },
};

// Fallback: copy DE game labels for pl, it; copy FR-ish for es; copy KO structure for ja/zh
for (const loc of ['pl', 'it']) {
  PATCHES[loc] = { game: PATCHES.de.game, duel: PATCHES.de.duel };
}
for (const loc of ['es', 'es-mx', 'pt-br']) {
  PATCHES[loc] = {
    game: {
      ...PATCHES.de.game,
      classes: { titan: 'Titán', hunter: 'Cazador', warlock: 'Hechicero' },
      slots: {
        helmet: 'Casco',
        arms: 'Brazos',
        chest: 'Pecho',
        legs: 'Piernas',
        classItem: 'Objeto de clase',
      },
    },
    duel: {
      keyboard: { left: 'Izquierda', both: 'Ambos', right: 'Derecha' },
      compare: { pass: 'Pasar' },
    },
  };
}
PATCHES.ru = {
  game: {
    classes: { titan: 'Титан', hunter: 'Охотник', warlock: 'Варлок' },
    stats: {
      weapons: 'Оружие',
      grenade: 'Граната',
      super: 'Супер',
      melee: 'Ближний бой',
      health: 'Здоровье',
      class: 'Класс',
    },
    diff: { noSet: 'Без сета', setFootnote: 'Сет: {{name}}' },
  },
};
PATCHES.ja = { game: PATCHES.ko.game, duel: PATCHES.ko.duel };
PATCHES['zh-chs'] = {
  game: {
    classes: { titan: '泰坦', hunter: '猎人', warlock: '术士' },
    stats: {
      weapons: '武器',
      grenade: '手雷',
      super: '超级技能',
      melee: '近战',
      health: '生命值',
      class: '职业',
    },
    diff: { noSet: '无套装', setFootnote: '套装：{{name}}' },
  },
  duel: {
    keyboard: { left: '左', both: '双', right: '右' },
    compare: { pass: '跳过' },
  },
};
PATCHES['zh-cht'] = JSON.parse(JSON.stringify(PATCHES['zh-chs']));
PATCHES['zh-cht'].game.diff.setFootnote = '套裝：{{name}}';
PATCHES['zh-cht'].game.diff.noSet = '無套裝';

for (const locale of LOCALES) {
  const patch = PATCHES[locale];
  if (!patch) continue;
  for (const [namespace, data] of Object.entries(patch)) {
    const filePath = path.join(LOCALES_DIR, locale, `${namespace}.json`);
    const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    deepMerge(existing, data);
    fs.writeFileSync(filePath, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
  }
  console.log(`Applied game/duel: ${locale}`);
}
