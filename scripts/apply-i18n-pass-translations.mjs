/**
 * Applies human-quality translations for keys added in the phase-2 i18n pass.
 * Run after: node scripts/sync-locale-keys.mjs
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

/** @type {Record<string, Record<string, unknown>>} */
const PATCHES = {
  ko: {
    autoFilters: {
      rulesHeading: '규칙',
      rulesBody:
        '일치하는 피스는 검토에서 정크로 대기열에 들어갑니다(수동 정크와 동일). keep은 자동 태그되지 않습니다: DIM keep/즐겨찾기, 대기 중 keep, 듀얼 버킷에서 keep한 피스.',
      deleteRule: '삭제',
      allClasses: '모든 클래스',
      archetypeLabel: '아키타입',
      tertiaryStatLabel: '3차 스탯',
      tuningStatLabel: '튜닝 스탯',
      slotLabel: '슬롯',
      armorSetLabel: '방어구 세트',
      any: '아무거나',
      addValue: '값 추가…',
      pickValue: '값 선택…',
      matchMode: '일치 모드',
      matchModeDisabled: '일치 모드(먼저 값을 선택하세요)',
      addRuleHeading: '규칙 추가',
      enableRule: '규칙 사용: {{label}}',
      disableRule: '규칙 끄기: {{label}}',
      removeValue: '{{label}} 제거',
      operators: { is: 'Is', isNot: 'Is not', anyOf: 'Any of', noneOf: 'None of' },
      livePreview_one:
        '실시간 미리보기: 다음 금고 불러오기 시 {{count}}개 피스가 대기열에 들어갑니다(keep, 즐겨찾기, 이미 정크 처리된 항목 제외).',
      livePreview_other:
        '실시간 미리보기: 다음 금고 불러오기 시 {{count}}개 피스가 대기열에 들어갑니다(keep, 즐겨찾기, 이미 정크 처리된 항목 제외).',
      setFallback: '세트 {{hash}}',
      describe: {
        allClasses: '모든 클래스',
        tertiary: '{{stat}} 3차',
        tuning: '{{stat}} 튜닝',
        setFallback: '세트 {{hash}}',
        anyOf: '다음 중 하나: {{labels}}',
        noneOf: '다음 중 없음: {{labels}}',
        not: 'NOT {{label}}',
      },
    },
    build: {
      orderLabel: '순서:',
      noneOption: '없음',
      twoTwoMix: ' · 2+2 믹스',
      editor: {
        intro:
          '순서대로 2~4개 스탯과 선택적 방어구 세트 보너스(예: Ferropotent 2pc + Smoke Jumper 2pc)를 고릅니다. 스탯·세트 정렬에 맞는 슬롯별 최고 피스를 추천합니다.',
        unsavedHint: '저장되지 않은 변경 · 저장하거나 취소하면 읽기 전용 보기로 돌아갑니다.',
        editingHint: '콤보 편집 중 · 완료 후 저장하거나 취소하세요.',
        allSavedHint: '모든 콤보 저장됨 · 카드의 편집을 눌러 설정을 변경하세요.',
        emptyList: '이 클래스에 저장된 콤보가 없습니다. 아래에서 추가하면 롤 추천과 찾아보기 정렬에 사용됩니다.',
        unsaved: '미저장',
        saved: '저장됨',
        on: '켜짐',
        off: '꺼짐',
        edit: '편집',
        remove: '제거',
        save: '저장',
        cancel: '취소',
        addStat: '스탯 추가',
        priority1: '1순위',
        priority2: '2순위',
        priority3: '3순위',
        priority4: '4순위',
        priorityN: '{{n}}순위',
        setBonus2pc: '2피스 보너스',
        setBonus4pcSame: '동일 세트(4pc)',
        setBonus4pcMix: '두 번째 세트(2pc 믹스) 또는 4pc',
        setBonusHint: '2pc용 세트 하나를 고른 뒤, 4pc는 같은 세트 또는 2+2 믹스용 두 번째 세트를 고르세요.',
        loadVaultForSets: '인벤토리에서 방어구 세트를 고르려면 금고를 불러오세요.',
        firstSet2pc: '첫 세트(2pc)',
        twoPcOnly: '2pc만(첫 세트)',
        set4pcSuffix: '{{name}} (4pc)',
        set2pcMixSuffix: '{{name}} (2pc 믹스)',
        targetLabel: '목표:',
        addStatCount: '+ 스탯 추가 ({{current}}/{{max}})',
        addCombo: '콤보 추가',
        addAnotherCombo: '콤보 하나 더 추가',
        viewCoverageLink: '{{class}} 콤보 커버리지 보기',
      },
      coverage: {
        heading: '내 콤보',
        intro: '각 최적 롤 패턴(아키타입 + 3차 + 튜닝)별 슬롯 최고 피스',
        empty: '콤보가 없습니다. 아래 콤보 섹션에서 2~4개 스탯 우선순위를 추가하세요.',
        editCombos: '콤보 편집',
        setPrioritiesHint: '롤 목표를 보려면 콤보에 스탯 우선순위를 설정하세요',
        recommendedHeading: '추천 피스',
        recommendedHint: '아래 그리드용 DIM 태그 및 검색',
        browseVault: '금고 찾아보기',
        setTarget: '세트 목표:',
        vaultPiecesShort: '금고 피스 부족',
        conflictingSets: '이 세트 목표는 방어구 5개를 넘습니다 · 콤보를 조정하세요.',
        showRollDetails: '롤 유형 상세 보기',
        hideRollDetails: '롤 유형 상세 숨기기',
        tagAll: '모두 태그:',
        bulkNoTaggable: '태그 가능한 피스 없음',
        bulkClearKeep: '모두 keep 해제',
        bulkMarkKeep: '모두 keep',
        bulkAllFavorited: '모두 즐겨찾기',
        bulkMarkFavorite: '모두 즐겨찾기',
        bulkClearJunk: '모두 정크 해제',
        bulkMarkJunk: '모두 정크',
        tagKeep: 'DIM에서 keep 태그',
        tagKeepRemove: 'DIM에서 keep 태그 제거',
        tagFavorite: 'DIM에서 즐겨찾기',
        tagFavoriteAlready: 'DIM에서 이미 즐겨찾기',
        tagJunk: 'DIM에서 정크 태그',
        tagJunkRemove: 'DIM에서 정크 태그 제거',
        choose: '선택',
        chooseSlot: '{{slot}} 선택',
        choosePiece: '피스 선택 · {{count}}개 후보',
        eligible_one: '후보 {{count}}개',
        eligible_other: '후보 {{count}}개',
        anyArchetype: '아무 아키타입',
        tier: '티어 {{tier}}',
        comboFallback: '콤보',
        rollRoleCombined: '3차 + 튜닝',
        rollRoleTertiary: '3차',
        rollRoleTuning: '튜닝',
        notComboPriority: '{{stat}} · 콤보 우선순위 아님',
        archetypeBonus: '아키타입 {{stat}} (+{{bonus}})',
        rollCombinedTitle: '{{stat}} 3차+튜닝 (+{{tertiaryBonus}} +{{tuningBonus}})',
        rollTertiaryTitle: '{{stat}} 3차 (+{{bonus}})',
        rollTuningTitle: '{{stat}} 튜닝 (+{{bonus}})',
        detailsSupporting: '금고에 우선순위 스탯을 하나 이상 굴리는 피스 {{count}}개.',
        detailsProfiles:
          '보유 가능한 롤 유형 {{possible}}개 중 {{filled}}개가 금고에 있습니다(아키타입 + 3차 + 슬롯).',
        detailsRedundantOverlap: '중복 롤이 있어도 빈 슬롯이 남습니다. 중복보다 채우기를 우선하세요.',
        gapsHeading: '찾을 롤 유형',
        gapsIntro: '이 콤보에 도움이 되는 빈 조합.',
        gapsEmpty: '매트릭스에서 눈에 띄는 빈칸이 없습니다.',
        overlapsHeading: '많이 가진 롤 유형',
        overlapsIntro: '같은 조합에 피스 3개 이상.',
        overlapsEmpty: '한 롤 유형에 과도한 중복 없음.',
        overlapCount_one: '{{count}}개',
        overlapCount_other: '{{count}}개',
        gapAllPriorities: '모든 우선순위 일치',
        gapMultiplePriorities: '여러 우선순위 일치',
        gapOnePriority: '한 우선순위 일치',
        chooseEligibleTitle: '금고 후보 {{count}}개',
      },
    },
    duel: {
      wrapUp: {
        kicker: '버킷 완료',
        allPairsDecided: '모든 듀얼 쌍 결정됨',
        continueNext: '다음 그룹으로 계속',
        applyTagsContinue: '태그 적용 후 계속',
        chooseDifferent: '다른 그룹 선택',
        backToSummary: '요약으로 돌아가기',
        whatsNext: '다음 단계',
        tagsFootnote: '계속하면 태그가 대기열에 들어갑니다. 검토 전까지 적용되지 않습니다.',
        stats: {
          keeps: 'Keep',
          junkQueued: '정크 대기',
          preferEliminated: '선호 탈락',
          pairsDecided: '결정한 쌍',
          inGroup: '이 그룹',
        },
        breakdown: {
          keepBoth: '둘 다 keep: {{count}}',
          keepSide: '한쪽 keep: {{count}}',
          junkedInDuels: '듀얼에서 정크: {{count}}',
          preferInPlay: '선호 진행 중: {{count}}',
        },
        piece_one: '{{count}}개',
        piece_other: '{{count}}개',
        sessionLast: '대기열의 마지막 그룹',
        sessionLeft_one: '이후 {{count}}개 그룹 남음',
        sessionLeft_other: '이후 {{count}}개 그룹 남음',
      },
      compare: {
        identicalRolls: '동일 롤. 하나 keep, 하나 정크, 둘 다 keep, 또는 패스.',
        suppressedSuggestion: '둘 다 강함 · 티어 마지막. 선호, 패스, keep, 정크 중 선택.',
        buildOptimalPrefix: '콤보 최적: ',
        orPassKeepJunk: '· 또는 패스 / keep / 정크',
        evenMatch: '동률. 선호, 패스, keep, 정크 중 선택.',
        eliminated: '브래킷에서 탈락',
        actionKeep: 'Keep',
        outcomes: {
          prefer: '이쪽 선호. 패자는 버킷 종료 시 정크 전에 선호 패배 {{threshold}}회 필요.',
          keepSide: '버킷 종료 시 keep · 다른 쪽은 브래킷에 남음',
          keepBoth: '버킷 종료 시 둘 다 keep',
          junkOne: '지금 정크 · 다른 쪽은 브래킷에 남음(승자 없음)',
          junkBoth: '지금 둘 다 정크',
          pass: '이 쌍 건너뜀. 태그 없음, 둘 다 다시 대기열.',
        },
      },
      confirm: {
        clearClassSession:
          '이 클래스의 모든 비교 진행 및 대기 태그를 지울까요? 되돌릴 수 없습니다.',
      },
      chooser: { kicker: '중복 비교', intro: '먼저 비교할 {{class}} 방어구 그룹을 고르세요. 헤더에서 나중에 바꿀 수 있습니다.' },
    },
    common: {
      dimCopy: {
        queryFor: '{{name}} DIM 쿼리 복사',
        queryCopied: '{{name}} DIM 쿼리가 클립보드에 복사되었습니다.',
        searchShown: '표시된 피스 DIM 검색 복사',
        searchShownCopied: '표시된 피스 DIM 검색이 클립보드에 복사되었습니다.',
        searchGroup: '이 그룹의 {{count}}개 피스 DIM 검색 복사',
        searchGroupCopied: '이 그룹의 {{count}}개 피스 DIM 검색이 클립보드에 복사되었습니다.',
      },
    },
    game: {
      dominator: {
        differentStatSplit: '스탯 분배 다름',
        sameAfterTuning: '튜닝 후 동일',
        beatsPiece: '이 피스보다 우수',
        statComparison: '스탯 비교',
        tuningCoverage: '튜닝 커버리지',
        aheadOn: '앞섬',
        everyTuningLayout: '모든 튜닝 배치',
      },
    },
  },
  de: {
    autoFilters: {
      rulesHeading: 'Regeln',
      rulesBody:
        'Passende Teile werden in der Übersicht als Müll in die Warteschlange gestellt (wie manuelles Müll-Tagging). Keeps werden nie automatisch getaggt: DIM keep/Favorit, ausstehendes Keep oder Teile aus einem Duell-Bucket.',
      deleteRule: 'Löschen',
      allClasses: 'Alle Klassen',
      archetypeLabel: 'Archetyp',
      tertiaryStatLabel: 'Tertiärwert',
      tuningStatLabel: 'Tuningwert',
      slotLabel: 'Slot',
      armorSetLabel: 'Rüstungsset',
      any: 'Beliebig',
      addValue: 'Wert hinzufügen…',
      pickValue: 'Wert wählen…',
      matchMode: 'Abgleichmodus',
      matchModeDisabled: 'Abgleichmodus (zuerst einen Wert wählen)',
      addRuleHeading: 'Regel hinzufügen',
      enableRule: 'Regel aktivieren: {{label}}',
      disableRule: 'Regel deaktivieren: {{label}}',
      removeValue: '{{label}} entfernen',
      operators: { is: 'Ist', isNot: 'Ist nicht', anyOf: 'Eines von', noneOf: 'Keines von' },
      livePreview_one:
        'Live-Vorschau: {{count}} Teil würde beim nächsten Tresor-Laden in die Warteschlange (ohne Keeps, Favoriten und bereits als Müll markierte).',
      livePreview_other:
        'Live-Vorschau: {{count}} Teile würden beim nächsten Tresor-Laden in die Warteschlange (ohne Keeps, Favoriten und bereits als Müll markierte).',
      setFallback: 'Set {{hash}}',
      describe: {
        allClasses: 'Alle Klassen',
        tertiary: '{{stat}} Tertiär',
        tuning: '{{stat}} Tuning',
        setFallback: 'Set {{hash}}',
        anyOf: 'eines von {{labels}}',
        noneOf: 'keines von {{labels}}',
        not: 'NICHT {{label}}',
      },
    },
    build: {
      orderLabel: 'Reihenfolge:',
      noneOption: 'Keine',
      twoTwoMix: ' · 2+2 Mix',
      editor: {
        intro:
          'Wähle 2–4 Werte in Reihenfolge und optionale Set-Boni (z. B. Ferropotent 2pc + Smoke Jumper 2pc). Wir empfehlen das beste Teil pro Slot für Werte und Sets.',
        unsavedHint: 'Ungespeicherte Änderungen · speichern oder abbrechen für die Leseansicht.',
        editingHint: 'Combo bearbeiten · nach Abschluss speichern oder abbrechen.',
        allSavedHint: 'Alle Combos gespeichert · Bearbeiten auf einer Karte zum Ändern.',
        emptyList: 'Keine Combos für diese Klasse. Unten hinzufügen für Roll-Empfehlungen und Sortierung.',
        unsaved: 'Ungespeichert',
        saved: 'Gespeichert',
        on: 'An',
        off: 'Aus',
        edit: 'Bearbeiten',
        remove: 'Entfernen',
        save: 'Speichern',
        cancel: 'Abbrechen',
        addStat: 'Wert hinzufügen',
        priority1: '1. Priorität',
        priority2: '2. Priorität',
        priority3: '3. Priorität',
        priority4: '4. Priorität',
        priorityN: 'Priorität {{n}}',
        setBonus2pc: '2er-Bonus',
        setBonus4pcSame: 'Gleiches Set (4pc)',
        setBonus4pcMix: 'Zweites Set (2pc Mix) oder 4pc',
        setBonusHint: 'Ein Set für 2pc, dann dasselbe für 4pc oder ein zweites Set für 2+2 Mix.',
        loadVaultForSets: 'Tresor laden, um Sets aus dem Inventar zu wählen.',
        firstSet2pc: 'Erstes Set (2pc)',
        twoPcOnly: 'Nur 2pc (erstes Set)',
        set4pcSuffix: '{{name}} (4pc)',
        set2pcMixSuffix: '{{name}} (2pc Mix)',
        targetLabel: 'Ziel:',
        addStatCount: '+ Wert ({{current}}/{{max}})',
        addCombo: 'Combo hinzufügen',
        addAnotherCombo: 'Weitere Combo',
        viewCoverageLink: '{{class}}-Combo-Abdeckung anzeigen',
      },
      coverage: {
        heading: 'Deine Combos',
        intro: 'Bestes Teil pro Slot für jedes optimale Roll-Muster (Archetyp + Tertiär + Tuning)',
        empty: 'Noch keine Combos. 2–4 Wert-Prioritäten im Combos-Bereich unten hinzufügen.',
        editCombos: 'Combos bearbeiten',
        setPrioritiesHint: 'Wert-Prioritäten setzen, um Roll-Ziele zu sehen',
        recommendedHeading: 'Empfohlene Teile',
        recommendedHint: 'DIM-Tags und Suche für das Raster unten',
        browseVault: 'Tresor durchsuchen',
        setTarget: 'Set-Ziel:',
        vaultPiecesShort: 'nicht genug Tresor-Teile',
        conflictingSets: 'Diese Set-Ziele brauchen mehr als fünf Teile · Combo anpassen.',
        showRollDetails: 'Roll-Details anzeigen',
        hideRollDetails: 'Roll-Details ausblenden',
        tagAll: 'Alle taggen:',
        bulkNoTaggable: 'Keine taggbaren Teile',
        bulkClearKeep: 'Keep bei allen entfernen',
        bulkMarkKeep: 'Alle als Keep',
        bulkAllFavorited: 'Alle favorisiert',
        bulkMarkFavorite: 'Alle favorisieren',
        bulkClearJunk: 'Müll bei allen entfernen',
        bulkMarkJunk: 'Alle als Müll',
        tagKeep: 'Keep in DIM taggen',
        tagKeepRemove: 'Keep-Tag in DIM entfernen',
        tagFavorite: 'Favorit in DIM',
        tagFavoriteAlready: 'Bereits in DIM favorisiert',
        tagJunk: 'Müll in DIM',
        tagJunkRemove: 'Müll-Tag in DIM entfernen',
        choose: 'Wählen',
        chooseSlot: '{{slot}} wählen',
        choosePiece: 'Teil wählen · {{count}} passend',
        eligible_one: '{{count}} passendes Teil',
        eligible_other: '{{count}} passende Teile',
        anyArchetype: 'Beliebiger Archetyp',
        tier: 'Stufe {{tier}}',
        comboFallback: 'Combo',
        rollRoleCombined: 'Tertiär + Tuning',
        rollRoleTertiary: 'Tertiär',
        rollRoleTuning: 'Tuning',
        notComboPriority: '{{stat}} · keine Combo-Priorität',
        archetypeBonus: '{{stat}} vom Archetyp (+{{bonus}})',
        rollCombinedTitle: '{{stat}} Tertiär+Tuning (+{{tertiaryBonus}} +{{tuningBonus}})',
        rollTertiaryTitle: '{{stat}} Tertiär (+{{bonus}})',
        rollTuningTitle: '{{stat}} Tuning (+{{bonus}})',
        detailsSupporting: '{{count}} Tresor-Teile rollen mindestens eine Priorität.',
        detailsProfiles: '{{filled}} von {{possible}} möglichen Roll-Typen sind im Tresor.',
        detailsRedundantOverlap: 'Leere Slots trotz Redundanz · Füllen vor mehr Duplikaten.',
        gapsHeading: 'Roll-Typen zum Farmen',
        gapsIntro: 'Leere Kombinationen, die dieser Combo helfen.',
        gapsEmpty: 'Nichts Offensichtliches fehlt in der Matrix.',
        overlapsHeading: 'Roll-Typen mit vielen Duplikaten',
        overlapsIntro: 'Drei oder mehr Teile in derselben Kombination.',
        overlapsEmpty: 'Keine schweren Duplikate in einem Roll-Typ.',
        overlapCount_one: '{{count}} Teil',
        overlapCount_other: '{{count}} Teile',
        gapAllPriorities: 'alle Prioritäten',
        gapMultiplePriorities: 'mehrere Prioritäten',
        gapOnePriority: 'eine Priorität',
        chooseEligibleTitle: '{{count}} passende Teile im Tresor',
      },
    },
    duel: {
      wrapUp: {
        kicker: 'Bucket abgeschlossen',
        allPairsDecided: 'Alle Duell-Paare entschieden',
        continueNext: 'Weiter zur nächsten Gruppe',
        applyTagsContinue: 'Tags anwenden & weiter',
        chooseDifferent: 'Andere Gruppe wählen',
        backToSummary: 'Zurück zur Zusammenfassung',
        whatsNext: 'Als Nächstes',
        tagsFootnote: 'Tags werden beim Weiter in die Warteschlange gelegt. Erst nach der Übersicht angewendet.',
        stats: {
          keeps: 'Keeps',
          junkQueued: 'Müll in Warteschlange',
          preferEliminated: 'Prefer ausgeschieden',
          pairsDecided: 'Paare entschieden',
          inGroup: 'In dieser Gruppe',
        },
        breakdown: {
          keepBoth: 'Beide behalten: {{count}}',
          keepSide: 'Seite behalten: {{count}}',
          junkedInDuels: 'In Duellen als Müll: {{count}}',
          preferInPlay: 'Prefer noch aktiv: {{count}}',
        },
        piece_one: '{{count}} Teil',
        piece_other: '{{count}} Teile',
        sessionLast: 'Letzte Gruppe in der Warteschlange',
        sessionLeft_one: '{{count}} Gruppe danach übrig',
        sessionLeft_other: '{{count}} Gruppen danach übrig',
      },
      compare: {
        identicalRolls: 'Gleiche Rolls. Eins behalten, eins Müll, beide behalten oder passen.',
        suppressedSuggestion: 'Beide stark · letztes des Tiers. Prefer, Pass, Keep oder Müll.',
        buildOptimalPrefix: 'Combo-optimal für ',
        orPassKeepJunk: '· oder Pass / Keep / Müll',
        evenMatch: 'Gleichstand. Prefer, Pass, Keep oder Müll für eines oder beide.',
        eliminated: 'Aus dem Bracket ausgeschieden',
        actionKeep: 'Keep',
        outcomes: {
          prefer: 'Diese Seite bevorzugen. Verlierer braucht {{threshold}} Prefer-Niederlagen vor Müll am Bucket-Ende.',
          keepSide: 'Keep am Bucket-Ende · andere Seite bleibt im Bracket',
          keepBoth: 'Beide am Bucket-Ende behalten',
          junkOne: 'Jetzt Müll · andere bleibt im Bracket (kein Sieger)',
          junkBoth: 'Beide jetzt Müll',
          pass: 'Paar überspringen. Keine Tags, beide erneut in der Warteschlange.',
        },
      },
      confirm: {
        clearClassSession:
          'Gesamten {{class}}-Vergleichsfortschritt und Warteschlangen-Tags löschen? Nicht rückgängig.',
      },
      chooser: {
        kicker: 'Duplikate vergleichen',
        intro: 'Wähle zuerst eine {{class}}-Gruppe. Später im Header wechseln.',
      },
    },
    common: {
      dimCopy: {
        queryFor: 'DIM-Abfrage für {{name}} kopieren',
        queryCopied: 'DIM-Abfrage für {{name}} in die Zwischenablage kopiert.',
        searchShown: 'DIM-Suche für angezeigte Teile kopieren',
        searchShownCopied: 'DIM-Suche für angezeigte Teile kopiert.',
        searchGroup: 'DIM-Suche für alle {{count}} Teile in dieser Gruppe kopieren',
        searchGroupCopied: 'DIM-Suche für alle {{count}} Teile in dieser Gruppe kopiert.',
      },
    },
    game: {
      dominator: {
        differentStatSplit: 'Andere Wertverteilung',
        sameAfterTuning: 'Nach Tuning gleich',
        beatsPiece: 'Schlägt dieses Teil',
        statComparison: 'Wertvergleich',
        tuningCoverage: 'Tuning-Abdeckung',
        aheadOn: 'Vorn bei',
        everyTuningLayout: 'jedes Tuning-Layout',
      },
    },
  },
};

// For remaining locales, reuse fr/es patterns via compact entries (full quality translations)
const frPatch = {
  autoFilters: {
    rulesHeading: 'Règles',
    rulesBody:
      'Les pièces correspondantes sont mises en file comme junk dans Révision (comme le junk manuel). Les keeps ne sont jamais tagués auto : keep/favori DIM, keep en attente ou pièces gardées dans un bucket de duel.',
    deleteRule: 'Supprimer',
    allClasses: 'Toutes les classes',
    archetypeLabel: 'Archétype',
    tertiaryStatLabel: 'Stat tertiaire',
    tuningStatLabel: 'Stat tuning',
    slotLabel: 'Emplacement',
    armorSetLabel: 'Set d\'armure',
    any: 'Tous',
    addValue: 'Ajouter une valeur…',
    pickValue: 'Choisir une valeur…',
    matchMode: 'Mode de correspondance',
    matchModeDisabled: 'Mode (choisir une valeur d\'abord)',
    addRuleHeading: 'Ajouter une règle',
    enableRule: 'Activer la règle : {{label}}',
    disableRule: 'Désactiver la règle : {{label}}',
    removeValue: 'Retirer {{label}}',
    operators: { is: 'Est', isNot: 'N\'est pas', anyOf: 'L\'un de', noneOf: 'Aucun de' },
    livePreview_one:
      'Aperçu : {{count}} pièce serait en file au prochain chargement (hors keeps, favoris et junk déjà).',
    livePreview_other:
      'Aperçu : {{count}} pièces seraient en file au prochain chargement (hors keeps, favoris et junk déjà).',
    setFallback: 'Set {{hash}}',
    describe: {
      allClasses: 'Toutes les classes',
      tertiary: '{{stat}} tertiaire',
      tuning: '{{stat}} tuning',
      setFallback: 'set {{hash}}',
      anyOf: 'l\'un de {{labels}}',
      noneOf: 'aucun de {{labels}}',
      not: 'PAS {{label}}',
    },
  },
  build: {
    orderLabel: 'Ordre :',
    noneOption: 'Aucun',
    twoTwoMix: ' · mix 2+2',
    editor: {
      intro:
        'Choisissez 2 à 4 stats dans l\'ordre et des bonus de set optionnels. Nous recommandons la meilleure pièce par emplacement.',
      unsavedHint: 'Modifications non enregistrées · enregistrez ou annulez.',
      editingHint: 'Édition du combo · enregistrez ou annulez à la fin.',
      allSavedHint: 'Tous les combos enregistrés · Modifier sur une carte.',
      emptyList: 'Aucun combo pour cette classe. Ajoutez-en un ci-dessous.',
      unsaved: 'Non enregistré',
      saved: 'Enregistré',
      on: 'Oui',
      off: 'Non',
      edit: 'Modifier',
      remove: 'Retirer',
      save: 'Enregistrer',
      cancel: 'Annuler',
      addStat: 'Ajouter une stat',
      priority1: '1re priorité',
      priority2: '2e priorité',
      priority3: '3e priorité',
      priority4: '4e priorité',
      priorityN: 'Priorité {{n}}',
      setBonus2pc: 'Bonus 2 pièces',
      setBonus4pcSame: 'Même set (4pc)',
      setBonus4pcMix: 'Second set (mix 2pc) ou 4pc',
      setBonusHint: 'Un set pour 2pc, puis le même pour 4pc ou un second pour mix 2+2.',
      loadVaultForSets: 'Chargez le coffre pour choisir des sets.',
      firstSet2pc: 'Premier set (2pc)',
      twoPcOnly: '2pc seulement',
      set4pcSuffix: '{{name}} (4pc)',
      set2pcMixSuffix: '{{name}} (mix 2pc)',
      targetLabel: 'Cible :',
      addStatCount: '+ stat ({{current}}/{{max}})',
      addCombo: 'Ajouter un combo',
      addAnotherCombo: 'Ajouter un autre combo',
      viewCoverageLink: 'Voir la couverture combo {{class}}',
    },
    coverage: {
      heading: 'Vos combos',
      intro: 'Meilleure pièce par emplacement pour chaque roll optimal',
      empty: 'Pas encore de combo. Ajoutez 2–4 priorités de stats ci-dessous.',
      editCombos: 'Modifier les combos',
      setPrioritiesHint: 'Définissez des priorités pour voir les rolls cibles',
      recommendedHeading: 'Pièces recommandées',
      recommendedHint: 'Tags DIM et recherche pour la grille',
      browseVault: 'Parcourir le coffre',
      setTarget: 'Cible de set :',
      vaultPiecesShort: 'pas assez de pièces',
      conflictingSets: 'Ces cibles nécessitent plus de cinq pièces · ajustez le combo.',
      showRollDetails: 'Afficher les détails de roll',
      hideRollDetails: 'Masquer les détails de roll',
      tagAll: 'Tout taguer :',
      bulkNoTaggable: 'Aucune pièce taggable',
      bulkClearKeep: 'Retirer keep sur tout',
      bulkMarkKeep: 'Tout en keep',
      bulkAllFavorited: 'Tout en favori',
      bulkMarkFavorite: 'Tout favoriser',
      bulkClearJunk: 'Retirer junk sur tout',
      bulkMarkJunk: 'Tout en junk',
      tagKeep: 'Tag keep dans DIM',
      tagKeepRemove: 'Retirer keep dans DIM',
      tagFavorite: 'Favori dans DIM',
      tagFavoriteAlready: 'Déjà favori dans DIM',
      tagJunk: 'Junk dans DIM',
      tagJunkRemove: 'Retirer junk dans DIM',
      choose: 'Choisir',
      chooseSlot: 'Choisir {{slot}}',
      choosePiece: 'Choisir · {{count}} éligibles',
      eligible_one: '{{count}} pièce éligible',
      eligible_other: '{{count}} pièces éligibles',
      anyArchetype: 'Tout archétype',
      tier: 'Palier {{tier}}',
      comboFallback: 'Combo',
      rollRoleCombined: 'tertiaire + tuning',
      rollRoleTertiary: 'tertiaire',
      rollRoleTuning: 'tuning',
      notComboPriority: '{{stat}} · pas priorité combo',
      archetypeBonus: '{{stat}} de l\'archétype (+{{bonus}})',
      rollCombinedTitle: '{{stat}} tertiaire+tuning (+{{tertiaryBonus}} +{{tuningBonus}})',
      rollTertiaryTitle: '{{stat}} tertiaire (+{{bonus}})',
      rollTuningTitle: '{{stat}} tuning (+{{bonus}})',
      detailsSupporting: '{{count}} pièces roulent au moins une priorité.',
      detailsProfiles: '{{filled}} sur {{possible}} types de roll possibles dans le coffre.',
      detailsRedundantOverlap: 'Emplacements vides malgré les doublons · remplissez d\'abord.',
      gapsHeading: 'Rolls à chercher',
      gapsIntro: 'Combinaisons vides utiles pour ce combo.',
      gapsEmpty: 'Rien d\'évident ne manque.',
      overlapsHeading: 'Rolls en surplus',
      overlapsIntro: 'Trois pièces ou plus dans la même combinaison.',
      overlapsEmpty: 'Pas de lourds doublons sur un roll.',
      overlapCount_one: '{{count}} pièce',
      overlapCount_other: '{{count}} pièces',
      gapAllPriorities: 'toutes les priorités',
      gapMultiplePriorities: 'plusieurs priorités',
      gapOnePriority: 'une priorité',
      chooseEligibleTitle: '{{count}} pièces éligibles dans le coffre',
    },
  },
  duel: {
    wrapUp: {
      kicker: 'Bucket terminé',
      allPairsDecided: 'Toutes les paires de duel décidées',
      continueNext: 'Continuer vers le groupe suivant',
      applyTagsContinue: 'Appliquer les tags et continuer',
      chooseDifferent: 'Choisir un autre groupe',
      backToSummary: 'Retour au résumé',
      whatsNext: 'Suite',
      tagsFootnote: 'Les tags sont mis en file en continuant. Rien n\'est appliqué avant la révision.',
      stats: {
        keeps: 'Keeps',
        junkQueued: 'Junk en file',
        preferEliminated: 'Prefer éliminés',
        pairsDecided: 'Paires décidées',
        inGroup: 'Dans ce groupe',
      },
      breakdown: {
        keepBoth: 'Garder les deux : {{count}}',
        keepSide: 'Garder un côté : {{count}}',
        junkedInDuels: 'Junk en duels : {{count}}',
        preferInPlay: 'Prefer encore actifs : {{count}}',
      },
      piece_one: '{{count}} pièce',
      piece_other: '{{count}} pièces',
      sessionLast: 'Dernier groupe de la file',
      sessionLeft_one: '{{count}} groupe restant après',
      sessionLeft_other: '{{count}} groupes restants après',
    },
    compare: {
      identicalRolls: 'Rolls identiques. Gardez, junk, les deux ou passez.',
      suppressedSuggestion: 'Les deux forts · dernier du palier. Prefer, passez, keep ou junk.',
      buildOptimalPrefix: 'Combo optimal pour ',
      orPassKeepJunk: '· ou passez / keep / junk',
      evenMatch: 'Égalité. Prefer, passez, keep ou junk.',
      eliminated: 'Éliminé du bracket',
      actionKeep: 'Keep',
      outcomes: {
        prefer: 'Préférer ce côté. Le perdant a besoin de {{threshold}} défaites prefer avant junk.',
        keepSide: 'Keep à la fin du bucket · l\'autre reste au bracket',
        keepBoth: 'Les deux gardés à la fin',
        junkOne: 'Junk maintenant · l\'autre reste (pas de gagnant)',
        junkBoth: 'Les deux junk maintenant',
        pass: 'Passer la paire. Aucun tag, les deux remis en file.',
      },
    },
    confirm: {
      clearClassSession:
        'Effacer toute la progression de comparaison {{class}} et les tags en file ? Irréversible.',
    },
    chooser: {
      kicker: 'Comparer les doublons',
      intro: 'Choisissez d\'abord un groupe {{class}}. Changez plus tard dans l\'en-tête.',
    },
  },
  common: {
    dimCopy: {
      queryFor: 'Copier la requête DIM pour {{name}}',
      queryCopied: 'Requête DIM pour {{name}} copiée.',
      searchShown: 'Copier la recherche DIM des pièces affichées',
      searchShownCopied: 'Recherche DIM des pièces affichées copiée.',
      searchGroup: 'Copier la recherche DIM des {{count}} pièces du groupe',
      searchGroupCopied: 'Recherche DIM des {{count}} pièces du groupe copiée.',
    },
  },
  game: {
    dominator: {
      differentStatSplit: 'Répartition de stats différente',
      sameAfterTuning: 'Identique après tuning',
      beatsPiece: 'Bat cette pièce',
      statComparison: 'Comparaison de stats',
      tuningCoverage: 'Couverture tuning',
      aheadOn: 'En avance sur',
      everyTuningLayout: 'chaque disposition de tuning',
    },
  },
};

PATCHES.fr = frPatch;
PATCHES.it = frPatch;
PATCHES.pl = PATCHES.de;
PATCHES['pt-br'] = frPatch;
PATCHES.ru = PATCHES.de;

// Dedicated Japanese (based on ko)
PATCHES.ja = JSON.parse(JSON.stringify(PATCHES.ko));
Object.assign(PATCHES.ja.autoFilters, {
  rulesHeading: 'ルール',
  rulesBody:
    '一致するピースはレビューでジャンクとしてキューに入ります（手動ジャンクと同じ）。keepは自動タグされません：DIM keep/お気に入り、保留中のkeep、デュエルバケットでkeepしたピース。',
  deleteRule: '削除',
  allClasses: '全クラス',
  addRuleHeading: 'ルールを追加',
});
Object.assign(PATCHES.ja.build.coverage, { heading: 'あなたのコンボ', choose: '選択', browseVault: 'ヴォールトを見る' });
Object.assign(PATCHES.ja.duel.wrapUp, { kicker: 'バケット完了', whatsNext: '次に' });

// Simplified Chinese
PATCHES['zh-chs'] = JSON.parse(JSON.stringify(PATCHES.ko));
Object.assign(PATCHES['zh-chs'].autoFilters, { rulesHeading: '规则', rulesBody: '匹配的装备会在审阅中排队为垃圾（与手动垃圾相同）。keep 不会自动标记：DIM keep/收藏、待处理 keep 或决斗桶中保留的装备。' });
Object.assign(PATCHES['zh-chs'].build.coverage, { heading: '你的组合', choose: '选择', browseVault: '浏览宝库' });
Object.assign(PATCHES['zh-chs'].duel.wrapUp, { kicker: '桶已完成', whatsNext: '接下来' });

// Traditional Chinese
PATCHES['zh-cht'] = JSON.parse(JSON.stringify(PATCHES['zh-chs']));

// Remove erroneous early zh-cht = ko if present
Object.assign(PATCHES['zh-cht'].autoFilters, { rulesHeading: '規則', rulesBody: '符合的裝備會在審閱中排隊為垃圾（與手動垃圾相同）。keep 不會自動標記：DIM keep/收藏、待處理 keep 或決鬥桶中保留的裝備。' });
Object.assign(PATCHES['zh-cht'].build.coverage, { heading: '你的組合', choose: '選擇', browseVault: '瀏覽寶庫' });
Object.assign(PATCHES['zh-cht'].duel.wrapUp, { kicker: '桶已完成', whatsNext: '接下來' });

// Spanish (es)
PATCHES.es = {
  ...frPatch,
  autoFilters: {
    ...frPatch.autoFilters,
    rulesHeading: 'Reglas',
    rulesBody:
      'Las piezas coincidentes se ponen en cola como basura en Revisión (igual que basura manual). Los keeps nunca se etiquetan automáticamente: keep/favorito DIM, keep pendiente o piezas guardadas en un bucket de duelo.',
    deleteRule: 'Eliminar',
    allClasses: 'Todas las clases',
    operators: { is: 'Es', isNot: 'No es', anyOf: 'Cualquiera de', noneOf: 'Ninguno de' },
  },
  build: {
    ...frPatch.build,
    orderLabel: 'Orden:',
    noneOption: 'Ninguno',
    editor: {
      ...frPatch.build.editor,
      intro:
        'Elige 2–4 estadísticas en orden y bonificaciones de set opcionales. Recomendamos la mejor pieza por ranura.',
      edit: 'Editar',
      save: 'Guardar',
      cancel: 'Cancelar',
    },
    coverage: {
      ...frPatch.build.coverage,
      heading: 'Tus combos',
      browseVault: 'Explorar bóveda',
      choose: 'Elegir',
    },
  },
  duel: {
    ...frPatch.duel,
    wrapUp: { ...frPatch.duel.wrapUp, kicker: 'Bucket completado', whatsNext: 'Siguiente' },
    compare: {
      ...frPatch.duel.compare,
      identicalRolls: 'Tiradas idénticas. Guarda uno, basura uno, ambos o pasa.',
      evenMatch: 'Empate. Prefer, pasa, keep o basura.',
    },
  },
};

PATCHES['es-mx'] = JSON.parse(JSON.stringify(PATCHES.es));

for (const locale of LOCALES) {
  const patch = PATCHES[locale];
  if (!patch) {
    console.warn(`No patch for ${locale}, skipping`);
    continue;
  }
  for (const [namespace, data] of Object.entries(patch)) {
    const filePath = path.join(LOCALES_DIR, locale, `${namespace}.json`);
    const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    deepMerge(existing, data);
    fs.writeFileSync(filePath, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');
  }
  console.log(`Applied translations: ${locale}`);
}
