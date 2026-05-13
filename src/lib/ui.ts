export type ToastTone = 'neutral' | 'success' | 'error'

const toastBaseClass = 'mb-4 rounded-lg px-3.5 py-3 font-bold'

const toastToneClass: Record<ToastTone, string> = {
  neutral: 'border border-white/10 bg-white/[0.06] text-[#d8dedc]',
  success: 'border border-[#47bf8f]/55 bg-[#47bf8f]/[0.12] text-[#bff0db]',
  error: 'border border-[#d94f3d]/60 bg-[#d94f3d]/[0.12] text-[#f2b4ab]',
}

export function toastClass(tone: ToastTone) {
  return `${toastBaseClass} ${toastToneClass[tone]}`
}

export const playerNameWithGroupClass = 'player-name-with-group inline-flex max-w-full min-w-0 items-center gap-1.5 align-middle [&>span:last-child]:min-w-0 [&>span:last-child]:[overflow-wrap:anywhere]'
export const eyebrowClass = 'eyebrow mb-2 text-[0.76rem] font-black uppercase tracking-normal text-[#e4b45e]'
export const playerGroupTagClass =
  'player-group-tag inline-flex min-h-5 flex-none items-center justify-center rounded-[5px] border border-[color-mix(in_srgb,var(--group-tag-color,#47bf8f)_62%,transparent)] bg-[color-mix(in_srgb,var(--group-tag-color,#47bf8f)_18%,transparent)] px-1.5 text-[0.7rem] font-black leading-none tracking-normal text-[color-mix(in_srgb,var(--group-tag-color,#47bf8f)_72%,white)]'
export const pageMainClass =
  'min-w-0 mx-auto w-[min(1180px,calc(100%_-_32px))] py-7 pb-[54px] max-[1023px]:w-[min(100%_-_24px,1180px)] max-[1023px]:py-[18px] max-[1023px]:pb-[42px] max-[480px]:w-[min(100%_-_18px,1180px)]'
export const standardPanelClass =
  'panel rounded-lg border border-white/[0.10] bg-white/[0.055] p-[clamp(18px,3vw,28px)] mt-[18px] first:mt-0 max-[720px]:px-[clamp(14px,4vw,18px)]'
export const emptyStatePanelClass =
  `${standardPanelClass} empty-state min-h-[320px] grid content-center justify-items-center text-center gap-2.5 [&_p]:text-[#c0c8c6]`
export const draftMainClass =
  'wide-page draft-page mx-auto grid h-full min-h-0 w-[min(1680px,calc(100%_-_32px))] min-w-0 py-7 pb-[54px] max-[1023px]:w-[min(100%_-_24px,1680px)] max-[1023px]:py-[18px] max-[1023px]:pb-[42px] max-[860px]:h-auto max-[480px]:w-[min(100%_-_18px,1680px)]'
export const adminMainClass =
  'admin-main mx-auto grid h-[calc(100dvh_-_77px)] min-h-0 w-[calc(100%_-_32px)] max-w-none grid-rows-[minmax(0,1fr)] overflow-hidden px-0 py-4 max-[1023px]:h-auto max-[1023px]:min-h-[calc(100dvh_-_66px)] max-[1023px]:w-[calc(100%_-_24px)] max-[1023px]:overflow-visible max-[480px]:w-[calc(100%_-_18px)]'
export const ratingsPageClass = `${pageMainClass} ratings-page grid min-h-0`
export const eventLinkBadgesClass =
  'event-link-badges mt-3 flex max-w-full flex-wrap gap-2 [&_a]:inline-flex [&_a]:min-h-[34px] [&_a]:w-fit [&_a]:max-w-full [&_a]:items-center [&_a]:gap-[7px] [&_a]:rounded-full [&_a]:px-0 [&_a]:text-[0.86rem] [&_a]:font-black [&_a]:text-[#d8dedc] [&_a]:transition-colors hover:[&_a]:text-[#f4f0e8] [&_span]:min-w-0 [&_span]:[overflow-wrap:anywhere]'
export const eventHeroClass =
  'event-hero grid gap-6 py-[clamp(24px,5vw,56px)] pb-8 [&_h1]:max-w-[820px]'
export const eventDescriptionClass =
  'event-description mt-2.5 max-w-[760px] text-base leading-normal text-[#c5cdca]'
export const eventSectionLabelClass =
  'event-section-label mb-2.5 text-[0.74rem] font-black uppercase text-[#8a9896]'
export const completedEventShowcaseClass =
  'completed-event-showcase relative grid justify-items-center gap-[18px] overflow-hidden rounded-lg border border-[#e4b45e]/[0.34] bg-[radial-gradient(circle_at_50%_28%,rgba(228,180,94,0.18),transparent_34%),linear-gradient(145deg,rgba(39,38,34,0.96),rgba(26,34,36,0.9))] p-[clamp(24px,5vw,52px)] text-center'
export const completedScoreClass =
  'completed-score z-[1] grid justify-items-center gap-1 [&_span]:text-[0.78rem] [&_span]:font-black [&_span]:uppercase [&_span]:text-[#e4b45e] [&_strong]:text-[clamp(3rem,9vw,7rem)] [&_strong]:leading-[0.88] [&_strong]:text-[#f8e4a9]'
export const trophyStageClass =
  'trophy-stage relative z-[1] grid min-h-[clamp(230px,38vw,360px)] w-[min(100%,420px)] place-items-center'
export function confettiClass(index: 1 | 2 | 3 | 4 | 5 | 6) {
  const positions = {
    1: 'confetti-1 left-[12%] bg-[#e4b45e]',
    2: 'confetti-2 left-[28%] bg-[#8de2bd] [animation-delay:0.55s]',
    3: 'confetti-3 left-[43%] bg-[#84bdf5] [animation-delay:1.1s]',
    4: 'confetti-4 right-[37%] bg-[#d7c8ff] [animation-delay:1.65s]',
    5: 'confetti-5 right-[22%] bg-[#ffc4bc] [animation-delay:2.2s]',
    6: 'confetti-6 right-[8%] bg-[#f8e4a9] [animation-delay:2.75s]',
  }
  return `confetti absolute top-[10%] h-[18px] w-2.5 rounded-sm opacity-0 [animation:confetti-fall_4.8s_ease-in-out_infinite] ${positions[index]}`
}
export const winnerDetailsClass =
  'winner-details z-[1] grid justify-items-center gap-2 [&_span]:text-[0.78rem] [&_span]:font-black [&_span]:uppercase [&_span]:text-[#e4b45e] [&_h2]:m-0 [&_h2]:text-[clamp(2.2rem,6vw,4.6rem)] [&_h2]:leading-[0.95] [&_h2]:text-[#f4f0e8] [&_p]:m-0 [&_p]:text-base [&_p]:text-[#c5cdca] [&_strong]:text-[#f8e4a9]'
export const winnerRosterClass =
  'winner-roster z-[1] mt-1.5 grid w-[min(760px,100%)] list-none grid-cols-2 gap-2 p-0 max-[720px]:grid-cols-[minmax(0,1fr)] [&_li]:flex [&_li]:min-w-0 [&_li]:items-center [&_li]:justify-between [&_li]:gap-2 [&_li]:rounded-md [&_li]:border [&_li]:border-white/[0.08] [&_li]:bg-white/[0.07] [&_li]:px-3 [&_li]:py-2.5 [&_a]:min-w-0 [&_a]:overflow-hidden [&_a]:text-ellipsis [&_a]:whitespace-nowrap [&_a]:font-extrabold [&_a]:text-[#f4f0e8] [&_a:hover]:text-[#f8e4a9] [&_small]:flex-none [&_small]:text-[0.7rem] [&_small]:font-black [&_small]:uppercase [&_small]:text-[#e4b45e]'
export function winnerTrophyClass(kind: 'biolab' | 'hamma-bowl') {
  const kindClass = kind === 'biolab' ? 'biolab-trophy w-[116%] place-items-center' : 'hamma-bowl-trophy'
  return `winner-trophy relative grid aspect-[1122/1402] max-w-full justify-items-center [filter:drop-shadow(0_24px_34px_rgba(0,0,0,0.32))_drop-shadow(0_0_34px_rgba(228,180,94,0.28))] ${kindClass} ${kind === 'hamma-bowl' ? 'w-[clamp(190px,34vw,330px)]' : ''}`
}
export const trophyImageClass =
  'block h-full w-full object-contain'
export function statPillClass(accent?: boolean) {
  return `stat-pill grid min-w-0 gap-1.5 rounded-md border p-3.5 px-[18px] [&_span]:text-[0.72rem] [&_span]:font-black [&_span]:uppercase [&_span]:text-[#8a9896] [&_strong]:min-w-0 [&_strong]:overflow-hidden [&_strong]:text-ellipsis [&_strong]:whitespace-nowrap [&_strong]:text-[1.3rem] [&_strong]:leading-none ${accent ? 'stat-pill-accent border-[#e4b45e]/30 bg-[#e4b45e]/[0.08] [&_strong]:text-[#e4b45e]' : 'border-white/[0.08] bg-white/[0.04] [&_strong]:text-[#f0ece3]'}`
}
export const roundProgressClass =
  'round-progress mt-[18px] grid gap-1 overflow-hidden rounded-lg border border-white/[0.12] bg-white/[0.05] max-[860px]:overflow-x-auto'
export function roundSegmentClass(state: string, faction?: string) {
  const factionTone =
    state === 'complete' && faction === 'VS'
      ? 'round-segment-vs bg-[#9660ff]/[0.20] [&_strong]:text-[#d7c8ff]'
      : state === 'complete' && faction === 'TR'
        ? 'round-segment-tr bg-[#d94f3d]/[0.20] [&_strong]:text-[#ffc4bc]'
        : state === 'complete' && faction === 'NC'
          ? 'round-segment-nc bg-[#47bf8f]/[0.20] [&_strong]:text-[#bff0db]'
          : state === 'complete'
            ? 'bg-[#47bf8f]/[0.16] [&_strong]:text-[#bff0db]'
            : state === 'active'
              ? 'border-[#e4b45e]/[0.36] bg-[#e4b45e]/[0.18] [animation:round-active-glow_4.6s_ease-in-out_infinite] [&_strong]:text-[#f9e2b5]'
              : 'round-segment-future bg-white/[0.035] [&_strong]:text-[#899391]'
  return `round-segment round-segment-${state}${faction ? ` round-segment-${faction.toLowerCase()}` : ''} grid min-h-[72px] min-w-0 content-center gap-1 border-l border-white/10 p-3 first:border-l-0 [&_span]:text-[0.74rem] [&_span]:font-black [&_span]:uppercase [&_span]:text-[#b4bcbb] [&_strong]:min-w-0 [&_strong]:overflow-hidden [&_strong]:text-ellipsis [&_strong]:whitespace-nowrap [&_strong]:text-base [&_strong]:text-[#f4f0e8] ${factionTone}`
}
export const roundActiveDotClass =
  'round-active-dot mt-1 inline-block h-[7px] w-[7px] rounded-full bg-[#e4b45e] shadow-[0_0_0_3px_rgba(228,180,94,0.2)]'
export const countdownInProgressClass =
  'countdown countdown-in-progress flex items-center gap-3 rounded-lg border border-[#47bf8f]/35 bg-[#47bf8f]/[0.10] px-6 py-5 [&_strong]:text-base [&_strong]:text-[#bff0db]'
export const countdownPulseClass =
  'countdown-pulse h-2.5 w-2.5 flex-none rounded-full bg-[#47bf8f] shadow-[0_0_0_3px_rgba(71,191,143,0.25)] [animation:countdown-pulse_2s_ease-in-out_infinite]'
export const countdownBlockClass = 'countdown-block grid min-w-0 gap-3.5'
export const countdownLabelClass = 'countdown-label text-[0.78rem] font-black uppercase'
export const countdownUnitsClass =
  'countdown-units flex min-w-0 items-start gap-2.5 overflow-x-auto pb-0.5 max-[560px]:gap-[7px]'
export const countdownUnitClass = 'countdown-unit grid flex-none justify-items-center gap-1'
export const countdownDigitClass =
  'countdown-digit flex h-16 min-w-16 items-center justify-center rounded-md border border-white/[0.12] bg-[#20262c] text-3xl font-black tabular-nums text-[#f0ece3] max-[560px]:h-14 max-[560px]:min-w-[52px] max-[560px]:text-[1.55rem]'
export const countdownUnitLabelClass =
  'countdown-unit-label text-[0.68rem] font-black uppercase text-[#8a9896]'
export const countdownSeparatorClass =
  'countdown-sep text-3xl font-black leading-[64px] text-[#8a9896] max-[560px]:text-2xl max-[560px]:leading-[56px]'
const eventTimeBadgeBaseClass =
  'event-time-badge inline-flex min-h-[34px] w-fit max-w-full items-center gap-[7px] rounded-full border px-3 pl-2.5 text-[0.86rem] font-black [&_svg]:flex-none [&_strong]:whitespace-nowrap [&_strong]:text-[0.86rem]'
export function eventTimeBadgeClass(className: string) {
  if (className === 'event-time-badge-signups') {
    return `${eventTimeBadgeBaseClass} ${className} border-[#f0c36b]/55 bg-[#f0c36b]/[0.14] text-[#fae6ba] [&_svg]:text-[#f0c36b] [&_strong]:text-[#fae6ba]`
  }
  if (className === 'event-time-badge-draft') {
    return `${eventTimeBadgeBaseClass} ${className} border-[#84bdf5]/55 bg-[#84bdf5]/[0.14] text-[#d7ebff] [&_svg]:text-[#84bdf5] [&_strong]:text-[#d7ebff]`
  }
  return `${eventTimeBadgeBaseClass} ${className} border-[#8de2bd]/55 bg-[#8de2bd]/[0.14] text-[#dff8ed] [&_svg]:text-[#8de2bd] [&_strong]:text-[#dff8ed]`
}
export const profileGroupTagLinkClass =
  `${playerGroupTagClass} profile-group-tag-link transition-[border-color,background,color] [transition-duration:120ms] hover:border-[color-mix(in_srgb,var(--group-tag-color,#47bf8f)_78%,white_12%)] hover:bg-[color-mix(in_srgb,var(--group-tag-color,#47bf8f)_28%,transparent)] hover:text-[color-mix(in_srgb,var(--group-tag-color,#47bf8f)_64%,white)]`
export const profileHeroClass =
  "profile-hero relative mt-3 grid min-h-[280px] items-end overflow-hidden rounded-lg bg-[#1e2226] bg-[linear-gradient(135deg,rgba(177,52,42,0.28),transparent_42%),linear-gradient(215deg,rgba(45,124,122,0.32),transparent_44%)] bg-cover bg-center p-[clamp(20px,4vw,36px)] before:absolute before:inset-0 before:bg-[linear-gradient(180deg,rgba(18,20,23,0.1),rgba(18,20,23,0.86))] before:content-[''] max-[1023px]:min-h-0 max-[720px]:p-[clamp(18px,5vw,28px)]"
export const profileEditIconClass =
  'profile-edit-icon absolute right-4 top-4 z-[2] grid min-h-[42px] w-[42px] place-items-center rounded-full border border-white/25 bg-[rgba(10,12,14,0.72)] p-0 text-[#fff7e6] backdrop-blur-[10px] hover:border-[#e4b45e]/[0.62] hover:bg-[#e4b45e]/[0.16] [&_svg]:h-[19px] [&_svg]:w-[19px] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-2 [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]'
export const profileIdentityClass =
  'profile-identity relative flex max-w-full items-center gap-[18px] [&>div]:min-w-0 [&>img]:aspect-square [&>img]:w-24 [&>img]:rounded-lg [&>img]:border-2 [&>img]:border-white/[0.18] [&>img]:bg-[#121417] [&>img]:object-cover [&>span]:grid [&>span]:aspect-square [&>span]:w-24 [&>span]:place-items-center [&>span]:rounded-lg [&>span]:border-2 [&>span]:border-white/[0.18] [&>span]:bg-[#121417] [&>span]:text-5xl [&>span]:font-black [&>span]:text-[#e4b45e]'
export const profileCatchphraseClass = 'profile-catchphrase mt-2.5 max-w-[760px] text-[1.1rem] text-[#d8dedc]'
export const profileHeroBadgesClass =
  'profile-hero-badges mt-3.5 flex max-w-full flex-wrap gap-2 [&_span]:inline-flex [&_span]:min-h-[34px] [&_span]:items-center [&_span]:rounded-full [&_span]:border [&_span]:border-[color-mix(in_srgb,var(--badge-color,#e4b45e)_72%,white_12%)] [&_span]:bg-[color-mix(in_srgb,var(--badge-color,#e4b45e)_26%,transparent)] [&_span]:px-3 [&_span]:text-[0.78rem] [&_span]:font-black [&_span]:uppercase [&_span]:text-[color-mix(in_srgb,var(--badge-color,#e4b45e)_72%,white_28%)]'
export const profileStatsGridClass = 'grid grid-cols-3 gap-2.5 m-0 max-[560px]:grid-cols-1'
export const profileMetricClass =
  'metric rounded-lg border border-white/[0.08] bg-white/[0.08] p-4 [&_dt]:block [&_dt]:text-[0.76rem] [&_dt]:font-black [&_dt]:uppercase [&_dt]:text-[#9aa5a3] [&_dd]:mt-1.5 [&_dd]:block [&_dd]:text-[1.55rem] [&_dd]:font-extrabold [&_dd]:leading-none [&_dd]:text-[#f4f0e8]'
export const adminBadgeEditorClass = 'admin-badge-editor grid gap-3'
export const modalBackdropClass =
  'modal-backdrop fixed inset-0 z-20 grid place-items-center bg-[rgba(5,7,9,0.76)] p-[18px]'
export const modalPanelClass =
  'modal-panel max-h-[min(760px,calc(100vh_-_36px))] w-[min(720px,100%)] overflow-auto rounded-lg border border-white/[0.14] bg-[#121417] p-[clamp(18px,3vw,26px)] shadow-[0_24px_80px_rgba(0,0,0,0.45)] max-[1023px]:max-h-[calc(100dvh_-_24px)] max-[1023px]:w-[min(100%_-_24px,720px)] max-[1023px]:overflow-y-auto'
export const adminProfileModalClass = `${modalPanelClass} admin-profile-modal grid gap-4 max-[1023px]:self-center`
export const modalCloseClass =
  'modal-close grid min-h-9 w-9 place-items-center rounded-full p-0 text-[1.35rem] leading-none'
export const bannerPickerClass =
  'banner-picker grid max-h-[430px] grid-cols-2 gap-2.5 overflow-y-auto overscroll-contain py-0.5 pl-0.5 pr-1.5 [scrollbar-color:rgba(240,180,107,0.75)_rgba(255,255,255,0.08)] max-[1023px]:grid-cols-1 aria-[disabled=true]:opacity-55'
export const bannerChoiceClass =
  'banner-choice relative grid cursor-pointer gap-2 text-[0.78rem] font-black uppercase text-[#d8dedc] max-[1023px]:min-w-[min(100%,260px)] [&_input]:pointer-events-none [&_input]:absolute [&_input]:min-h-px [&_input]:w-px [&_input]:opacity-0 [&_img]:aspect-[10/3] [&_img]:w-full [&_img]:rounded-lg [&_img]:border-2 [&_img]:border-white/[0.14] [&_img]:bg-[#121417] [&_img]:object-cover [&_img]:transition-[border-color,box-shadow] [&_img]:duration-[120ms] hover:[&_img]:border-[#e4b45e]/50 data-[selected=true]:[&_img]:border-[#f0b46b] data-[selected=true]:[&_img]:shadow-[0_0_0_3px_rgba(240,180,107,0.18)] [&_input:focus-visible+img]:outline-2 [&_input:focus-visible+img]:outline-offset-2 [&_input:focus-visible+img]:outline-[#e4b45e] [&_span]:leading-[1.2]'
export const badgeSettingsClass = 'badge-settings grid gap-2.5 [&_h3]:m-0 [&_h3]:text-[0.92rem]'
export const badgeSettingsListClass = 'badge-settings-list grid gap-2'
export const badgeSettingsRowClass =
  'badge-settings-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border border-white/[0.10] bg-white/[0.05] p-2.5 transition-colors data-[selected=true]:border-[#e4b45e]/[0.42] data-[selected=true]:bg-[#e4b45e]/[0.10] max-[720px]:grid-cols-1 [&_small]:mt-[3px] [&_small]:block [&_small]:font-bold [&_small]:text-[#b4bcbb] [&_.checkbox-field]:text-[#d8dedc]'
export const profileEventsTableWrapClass =
  'profile-events-table-wrap max-w-full overflow-x-auto rounded-lg border border-white/10 bg-white/[0.04] pb-2 max-[1023px]:[-webkit-overflow-scrolling:touch] max-[720px]:-mx-[clamp(14px,4vw,18px)] max-[720px]:px-[clamp(14px,4vw,18px)]'
export const profileEventsTableClass =
  'profile-events-table w-full min-w-[760px] table-fixed max-[1023px]:min-w-[820px] [&_th]:bg-white/[0.045] [&_th]:text-left [&_th]:align-middle [&_td]:text-left [&_td]:align-middle [&_th:first-child]:w-[44%] [&_th:nth-child(2)]:w-[24%] [&_th:nth-child(3)]:w-[16%] [&_th:nth-child(4)]:w-[16%] [&_td]:whitespace-normal [&_td]:[overflow-wrap:anywhere] [&_th]:px-4 [&_td]:px-4 [&_td:first-child_a]:block [&_td:first-child_a]:w-fit [&_td:first-child_a]:font-black [&_td:first-child_a]:text-[#f4f0e8] [&_td:first-child_a:hover]:text-[#f8e4a9]'
export const profileEventDateClass =
  'profile-event-date mt-1.5 block text-[0.82rem] font-bold leading-[1.2] text-[#a9b3b2]'
const profileEventResultBaseClass =
  'profile-event-result inline-flex min-h-7 items-center rounded-full border px-2.5 text-[0.72rem] font-black uppercase'
export function profileEventResultClass(winner: boolean) {
  return winner
    ? `${profileEventResultBaseClass} win border-[#e4b45e]/50 bg-[#e4b45e]/[0.12] text-[#f8e4a9]`
    : `${profileEventResultBaseClass} loss border-[#b1342a]/[0.46] bg-[#b1342a]/[0.12] text-[#ffb4aa]`
}
export function ratingChartClass(expanded: boolean) {
  return `rating-chart w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 pb-2 pt-3 transition-[height] duration-200 ${expanded ? 'rating-chart-expanded h-[440px]' : 'h-[280px]'}`
}
export const secondaryActionClass = 'secondary-action inline-flex min-h-[34px] items-center justify-center rounded-md border border-[#e4b45e]/[0.42] bg-[#e4b45e]/[0.08] px-3 py-1.5 font-bold text-[#f3d99d] max-[560px]:w-full'
export const dangerActionClass = 'danger-action inline-flex min-h-[34px] items-center justify-center rounded-md border border-[#d94f3d]/55 bg-[#d94f3d]/[0.12] px-3 py-1.5 font-bold text-[#f2b4ab] max-[560px]:w-full'
export const breadcrumbNavClass =
  'breadcrumb-nav mt-6 flex flex-wrap items-center gap-2 text-[0.84rem] font-black uppercase text-[#a9b3b2] [&_a]:text-[#f3d99d] [&_a]:transition-colors [&_a:hover]:text-[#fff7e6] [&>span:last-child]:text-[#d8dedc]'
export const infoListClass =
  'info-list grid gap-2.5 [&>span]:grid [&>span]:gap-[3px] [&>span]:rounded-lg [&>span]:border [&>span]:border-white/10 [&>span]:bg-white/[0.06] [&>span]:p-3 [&>span]:text-[#cbd5d3] [&_strong]:text-[#fff7e6]'
export const adminAssignmentInfoListClass = `admin-assignment-list ${infoListClass} grid-cols-2 max-[720px]:grid-cols-1`

const adminFormLabelClass =
  '[&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.82rem] [&_label]:font-extrabold [&_label]:uppercase [&_label]:text-[#b4bcbb]'
const adminFormControlClass =
  '[&_input]:min-h-10 [&_input]:w-full [&_input]:min-w-0 [&_input]:rounded-md [&_input]:border [&_input]:border-white/[0.18] [&_input]:bg-[#121417] [&_input]:px-2.5 [&_input]:font-semibold [&_input]:normal-case [&_input]:text-[#f4f0e8] [&_input]:transition-colors [&_select]:min-h-10 [&_select]:w-full [&_select]:min-w-0 [&_select]:rounded-md [&_select]:border [&_select]:border-white/[0.18] [&_select]:bg-[#121417] [&_select]:px-2.5 [&_select]:font-semibold [&_select]:normal-case [&_select]:text-[#f4f0e8] [&_select]:transition-colors'
const datetimeControlClass =
  '[&_.datetime-local-field_input]:min-h-[38px] [&_.datetime-local-field_input]:rounded-none [&_.datetime-local-field_input]:border-0 [&_.datetime-local-field_input]:bg-transparent [&_.datetime-local-field_input]:shadow-none [&_.datetime-local-field_input:focus-visible]:border-transparent [&_.datetime-local-field_input:focus-visible]:outline-0'

export const adminFormCardClass = `team-admin-card grid gap-3.5 rounded-lg border border-white/[0.10] bg-white/[0.05] p-4 ${adminFormLabelClass} ${adminFormControlClass} [&_input[type=color]]:w-[38px] [&_input[type=color]]:min-h-[30px] [&_input[type=color]]:p-0 ${datetimeControlClass}`
export const dangerZoneGridClass = 'danger-zone-grid grid grid-cols-1 gap-3'
export const dangerZoneCardClass =
  `danger-zone-card grid gap-3.5 rounded-lg border border-[#d94f3d]/60 bg-[#d94f3d]/[0.08] p-4 shadow-[inset_4px_0_0_rgba(217,79,61,0.75)] [&>strong]:text-[#ffd9d1] [&>p]:max-w-[860px] [&>p]:text-[#f2b4ab] ${adminFormLabelClass} ${adminFormControlClass} [&_input]:border-[#d94f3d]/[0.42] [&_input:focus-visible]:border-[#d94f3d]`

export const adminStackClass = 'admin-stack grid gap-4'
const mobileStackChildrenClass = 'max-[560px]:grid max-[560px]:grid-cols-1 max-[560px]:justify-stretch max-[560px]:[&>*]:w-full'
const mobileStackButtonClass = 'max-[560px]:grid max-[560px]:grid-cols-1 max-[560px]:[&_button]:w-full'
export const adminHeadingActionsClass = `admin-heading-actions flex min-w-[min(480px,100%)] flex-wrap items-end justify-end gap-2.5 ${mobileStackChildrenClass}`
export const adminHeadingEventSelectClass = 'admin-heading-event-select grid min-w-[min(460px,100%)] grid-cols-[minmax(220px,1fr)_auto] items-end gap-2.5 max-[560px]:grid-cols-1 max-[560px]:justify-stretch'
export const adminHeadingControlClass =
  'admin-heading-control grid min-w-[min(360px,100%)] gap-1.5 text-[0.8rem] font-extrabold uppercase text-[#b4bcbb] [&_select]:min-h-10 [&_select]:w-full [&_select]:min-w-0 [&_select]:rounded-md [&_select]:border [&_select]:border-white/[0.18] [&_select]:bg-[#121417] [&_select]:px-2.5 [&_select]:font-semibold [&_select]:normal-case [&_select]:text-[#f4f0e8] [&_select]:transition-colors'
export const eventModeChipClass = 'event-mode-chip inline-flex min-h-10 items-center whitespace-nowrap rounded-full border border-[#a1e3cb]/[0.28] bg-[#a1e3cb]/[0.10] px-3 text-[0.78rem] font-black uppercase text-[#d6f6ea] max-[560px]:w-fit'
export const adminSectionClass = 'admin-section grid min-w-0 scroll-mt-[calc(42dvh+86px)] gap-0 rounded-lg border border-white/[0.10] bg-white/[0.05] p-4 lg:scroll-mt-4'
export const adminSectionHeaderClass =
  'admin-section-header grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 max-[720px]:grid-cols-[auto_minmax(0,1fr)] max-[520px]:grid-cols-1 max-[520px]:items-start [&_h2]:m-0 [&_h2]:min-w-0 max-[720px]:[&_.admin-section-actions]:col-span-full max-[720px]:[&_.admin-section-actions]:justify-start'
export const adminSectionHeaderNoToggleClass =
  'admin-section-header grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 max-[520px]:grid-cols-1 max-[520px]:items-start [&_h2]:m-0 [&_h2]:min-w-0'
export const adminSectionActionsClass = `admin-section-actions flex min-w-0 flex-wrap items-center justify-end gap-2 ${mobileStackChildrenClass}`
export const adminSectionBodyClass = 'admin-section-body mt-3.5 grid gap-3.5 [&>p]:m-0'
export const adminSectionFooterClass = `admin-section-footer flex justify-end gap-2 ${mobileStackChildrenClass}`
export const collapseToggleClass =
  'collapse-toggle inline-grid min-h-8 w-8 place-items-center rounded-md border border-white/[0.14] bg-white/[0.07] p-0 text-[#f4f0e8] hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:opacity-55'
export const coinflipGridClass = 'coinflip-grid grid grid-cols-2 gap-3 max-[860px]:grid-cols-1 max-[720px]:min-w-0 max-[560px]:grid-cols-[minmax(0,1fr)]'
export const eventResultGridClass = 'event-result-grid grid grid-cols-3 gap-3 max-[860px]:grid-cols-1 max-[720px]:min-w-0 max-[560px]:grid-cols-[minmax(0,1fr)]'
export const assignmentGridClass = 'assignment-grid grid grid-cols-2 gap-3 max-[860px]:grid-cols-1 max-[720px]:min-w-0 max-[560px]:grid-cols-[minmax(0,1fr)]'
export const assignmentPanelClass = 'assignment-panel grid gap-3 border-t border-white/10 pt-3.5'
export const assignmentHeadingClass =
  'assignment-heading flex min-w-0 items-center justify-between gap-3 [&_strong]:min-w-0 [&_strong]:[overflow-wrap:anywhere] [&_strong]:text-[#f4f0e8]'
export const assignmentCardClass =
  'assignment-card grid min-w-0 gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3.5 [&>strong]:text-[#f4f0e8] [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.82rem] [&_label]:font-extrabold [&_label]:uppercase [&_label]:text-[#b4bcbb] [&_select]:min-h-10 [&_select]:w-full [&_select]:min-w-0 [&_select]:rounded-md [&_select]:border [&_select]:border-white/[0.18] [&_select]:bg-[#121417] [&_select]:px-2.5 [&_select]:font-semibold [&_select]:normal-case [&_select]:text-[#f4f0e8] [&_select]:transition-colors'
export const roundAdminGridClass = `${eventResultGridClass} round-admin-grid`
export const roundListCardClass = 'round-list-card col-span-2 max-[720px]:col-auto'
export const roundResultListClass = 'round-result-list grid gap-2.5'
export const roundResultRowClass =
  'round-result-row grid min-w-0 grid-cols-[minmax(74px,max-content)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 max-[720px]:grid-cols-1 [&>*]:min-w-0 [&>span]:font-black [&>span]:text-[#f4f0e8]'
export const roundScoreInputsClass =
  'round-score-inputs grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,120px),1fr))] gap-2 [&_label]:grid [&_label]:min-w-0 [&_label]:gap-1'
export const flowPanelClass =
  'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-lg border border-white/[0.12] bg-white/[0.045] p-3.5 max-[720px]:grid-cols-1 max-[720px]:items-stretch [&>div]:min-w-0 [&_p]:mt-1 [&_p]:mb-0 [&_p]:text-[#b4bcbb] [&_strong]:text-[#f4f0e8]'
export const flowActionsClass =
  `flex flex-wrap items-center justify-end gap-2 max-[720px]:justify-start ${mobileStackChildrenClass}`
export const checkRowClass =
  'check-row flex flex-wrap gap-2 [&_label]:flex [&_label]:min-h-[34px] [&_label]:items-center [&_label]:gap-1.5'
export const segmentedControlClass = 'segmented-control flex flex-wrap gap-2 [&_button]:min-h-9 [&_button]:px-3'
export const coinflipCallControlClass = `${segmentedControlClass} coinflip-call-control min-w-[172px]`
export function segmentedControlButtonClass(active: boolean) {
  return active ? 'active border-[#47bf8f]/75 bg-[#47bf8f]/[0.16]' : ''
}
export const coinflipSettingsHeadingClass =
  'coinflip-settings-heading mt-1 flex items-center justify-between gap-3 max-[720px]:justify-start [&_strong]:text-[#f4f0e8]'
export const coinflipFieldClass =
  'coinflip-field grid gap-1.5 text-[0.82rem] font-extrabold uppercase leading-[1.3] text-[#b4bcbb]'
export const chipInputClass =
  'chip-input flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-md border border-white/[0.18] bg-[#121417] p-[5px] aria-[disabled=true]:opacity-70 [&_input]:min-h-[30px] [&_input]:min-w-[90px] [&_input]:flex-[1_1_120px] [&_input]:border-0 [&_input]:bg-transparent [&_input]:px-1.5 [&_input:focus]:outline-none'
export const sideChipClass =
  'side-chip inline-flex min-h-[30px] max-w-full items-center gap-1.5 rounded-full border border-[#e4b45e]/[0.32] bg-[#e4b45e]/[0.12] py-0 pl-2.5 pr-1 normal-case text-[#f4f0e8]'
export const sideChipRemoveButtonClass =
  'inline-grid min-h-[22px] w-[22px] place-items-center rounded-full border-0 bg-white/10 p-0 leading-none text-[#f4f0e8] hover:not-disabled:bg-[#d94f3d]/[0.50]'
export const eventLinkEditorClass = 'event-link-editor grid gap-2.5'
export const eventLinkEditorHeadingClass =
  'event-link-editor-heading flex min-w-0 flex-wrap items-center justify-between gap-2.5 text-[0.82rem] font-extrabold uppercase text-[#b4bcbb] [&_button]:min-h-8 [&_button]:px-2.5 [&_span]:min-w-0 [&_span]:[overflow-wrap:anywhere]'
export const eventLinkEditorRowClass =
  'event-link-editor-row grid min-w-0 grid-cols-[minmax(110px,170px)_minmax(0,1fr)_auto_auto] items-end gap-2.5 max-[720px]:grid-cols-1 max-[720px]:items-stretch [&>*]:min-w-0'
export const eventIconPickerClass = 'event-icon-picker relative self-end max-[720px]:justify-self-start'
export const eventIconPickerTriggerClass =
  'event-icon-picker-trigger inline-flex min-h-10 min-w-[120px] items-center justify-start gap-1.5 rounded-md border border-white/[0.18] bg-[#121417] px-3.5 font-extrabold text-[#f4f0e8] hover:not-disabled:border-[#e4b45e]/[0.58] hover:not-disabled:bg-[#e4b45e]/[0.12] [&_span]:min-w-0 [&_span]:overflow-hidden [&_span]:text-ellipsis [&_span]:whitespace-nowrap'
export const eventIconPickerPopupClass =
  'event-icon-picker-popup absolute bottom-[calc(100%+8px)] right-0 z-20 grid w-max max-w-[min(252px,calc(100vw-48px))] grid-cols-[repeat(6,34px)] gap-1.5 self-end rounded-lg border border-white/[0.16] bg-[#171a1e] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.38)]'
export function eventIconPickerButtonClass(active: boolean) {
  return `h-[34px] min-h-[34px] w-[34px] rounded-md border p-0 ${active ? 'active border-[#e4b45e]/[0.58] bg-[#e4b45e]/[0.16] text-[#f4d59a]' : 'border-white/[0.14] bg-white/[0.07] text-[#d8dedc] hover:not-disabled:border-[#e4b45e]/[0.58] hover:not-disabled:bg-[#e4b45e]/[0.16] hover:not-disabled:text-[#f4d59a]'}`
}
export const roleComboboxClass = 'role-combobox relative grid gap-2'
export const roleComboboxControlClass =
  'role-combobox-control flex min-h-10 flex-wrap items-center gap-2 rounded-md border border-white/[0.18] bg-[#121417] p-[5px] focus-within:border-[#e4b45e] focus-within:outline focus-within:outline-2 focus-within:outline-offset-0 focus-within:outline-[#e4b45e]'
export const roleChipClass =
  'role-chip inline-flex min-h-[30px] items-center gap-1.5 rounded-full border border-[#47bf8f]/[0.42] bg-[#47bf8f]/[0.12] py-0 pl-2.5 pr-1 text-[0.78rem] font-black normal-case text-[#bff0db]'
export const roleChipRemoveButtonClass =
  'grid min-h-6 w-6 place-items-center rounded-full border border-white/[0.16] bg-white/[0.08] p-0 text-[#d8dedc] hover:not-disabled:border-[#d94f3d]/[0.72] hover:not-disabled:bg-[#d94f3d]/[0.18] hover:not-disabled:text-[#ffd9d1]'
export const roleComboboxMenuClass =
  'role-combobox-menu absolute left-0 right-0 top-[calc(100%+6px)] z-20 grid max-h-[260px] gap-1 overflow-auto rounded-lg border border-white/[0.16] bg-[#171a1e] p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.38)]'
export function roleComboboxOptionClass(active: boolean) {
  return `min-h-[34px] justify-start rounded-md border-0 bg-transparent px-2.5 text-left text-[#d8dedc] ${active ? 'bg-[#e4b45e]/[0.14] text-[#f3d99d]' : 'hover:not-disabled:bg-[#e4b45e]/[0.14] hover:not-disabled:text-[#f3d99d] focus-visible:bg-[#e4b45e]/[0.14] focus-visible:text-[#f3d99d]'}`
}
export const specOptionEditorClass = 'spec-option-editor grid gap-2'
export const specOptionRowClass =
  'spec-option-row grid min-w-0 grid-cols-[72px_minmax(0,1fr)_minmax(72px,88px)_auto] items-center gap-2 max-[560px]:grid-cols-[72px_minmax(0,1fr)] max-[560px]:[&>button]:col-span-full [&>*]:min-w-0'
export const specCheckboxGridClass =
  'spec-checkbox-grid grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2'
export const specLabelClass =
  'spec-label inline-flex min-w-0 items-center gap-1.5 [&_.emoji-preview]:inline-grid [&_.emoji-preview]:h-5 [&_.emoji-preview]:w-5 [&_.emoji-preview]:flex-none [&_.emoji-preview]:place-items-center [&_.emoji-preview]:object-contain [&_.emoji-preview]:text-lg [&_.emoji-preview]:leading-none'
export const emojiPreviewClass = 'emoji-preview'
export const specEmojiPickerClass = 'spec-emoji-picker relative'
export const specEmojiTriggerClass =
  'spec-emoji-trigger grid min-h-[42px] w-[72px] place-items-center justify-center rounded-md p-0 [&_img]:grid [&_img]:h-6 [&_img]:w-6 [&_img]:place-items-center [&_img]:object-contain [&_span]:grid [&_span]:h-6 [&_span]:w-6 [&_span]:place-items-center [&_span]:text-[22px] [&_span]:leading-none [&_.spec-emoji-placeholder]:!w-auto [&_.spec-emoji-placeholder]:!text-[11px] [&_.spec-emoji-placeholder]:text-[#8b9492]'
export const specEmojiPopoverClass =
  'spec-emoji-popover absolute left-0 top-[calc(100%+6px)] z-[25] grid max-h-[420px] w-[min(320px,82vw)] gap-2.5 overflow-auto rounded-lg border border-white/[0.16] bg-[#171a1e] p-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.38)]'
export const reminderEditorClass = 'reminder-editor grid gap-2.5'
export const reminderRowClass =
  'reminder-row grid min-w-0 grid-cols-[repeat(4,minmax(min(100%,120px),1fr))] items-end gap-2.5 rounded-md border border-white/[0.12] bg-white/[0.03] p-2.5 max-[860px]:grid-cols-1 [&>*]:min-w-0'
export const reminderMessageFieldClass = 'reminder-message-field col-span-3 max-[860px]:col-auto'
export const reminderRowActionsClass =
  `reminder-row-actions flex flex-wrap items-center justify-end gap-2.5 ${mobileStackChildrenClass} [&_small]:text-[0.78rem] [&_small]:font-extrabold [&_small]:text-[#a8b2ae]`

export const badgeAdminGridClass = 'badge-admin-grid grid min-w-0 grid-cols-[repeat(2,minmax(0,1fr))] gap-3.5 max-[720px]:grid-cols-1'
export const badgeDefinitionListClass = 'badge-definition-list grid min-w-0 gap-[18px] max-[720px]:grid-cols-1'
export const badgeDefinitionGroupClass =
  'badge-definition-group grid min-w-0 gap-2.5 [&_h3]:m-0 [&_h3]:min-w-0 [&_h3]:[overflow-wrap:anywhere] [&_h3]:text-[0.95rem] [&_h3]:tracking-normal [&_h3]:text-[#fff7e6]'
export const badgeDefinitionCardsClass = 'badge-definition-cards grid min-w-0 grid-cols-[repeat(2,minmax(0,1fr))] gap-3 max-[720px]:grid-cols-1'
export const badgeDefinitionCardClass =
  'badge-definition-card flex min-h-[260px] min-w-0 flex-col gap-3 rounded-lg border border-white/[0.12] bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.035)),#15171b] p-3.5 text-[#cbd5d3] [&>strong]:w-fit [&>strong]:max-w-full [&>strong]:[overflow-wrap:anywhere] [&>strong]:rounded-full [&>strong]:border [&>strong]:border-[color-mix(in_srgb,var(--badge-color,#e4b45e)_56%,white_10%)] [&>strong]:bg-[color-mix(in_srgb,var(--badge-color,#e4b45e)_18%,transparent)] [&>strong]:px-2.5 [&>strong]:py-[5px] [&>strong]:text-[color-mix(in_srgb,var(--badge-color,#e4b45e)_72%,white_28%)]'
export const badgeDefinitionFieldsClass =
  'badge-definition-fields grid min-w-0 gap-2.5 [&_label]:grid [&_label]:min-w-0 [&_label]:gap-1.5 [&_label]:text-[0.78rem] [&_label]:font-black [&_label]:uppercase [&_label]:text-[#b4bcbb] [&_input:not([type=color])]:min-h-10 [&_input:not([type=color])]:w-full [&_input:not([type=color])]:min-w-0 [&_input:not([type=color])]:rounded-md [&_input:not([type=color])]:border [&_input:not([type=color])]:border-white/[0.18] [&_input:not([type=color])]:bg-[#101216] [&_input:not([type=color])]:px-2.5 [&_input:not([type=color])]:font-semibold [&_input:not([type=color])]:normal-case [&_input:not([type=color])]:text-[#f4f0e8] [&_input:not([type=color])]:transition-colors [&_input:not([type=color]):focus]:border-[#e4b45e]/[0.62] [&_input:not([type=color]):focus]:bg-[#15181d] [&_input:not([type=color]):focus]:outline-none'
export const badgeDefinitionActionsClass =
  `badge-definition-actions mt-auto flex items-center justify-end gap-2 pt-0.5 ${mobileStackButtonClass} [&_button]:min-h-8 [&_button]:px-2.5`
export const inlineColorFieldClass =
  'inline-color-field inline-flex items-center gap-2 text-[0.76rem] font-black uppercase text-[#b4bcbb] [&_input]:h-6 [&_input]:min-h-6 [&_input]:w-[30px] [&_input]:border-0 [&_input]:bg-transparent [&_input]:p-0'
export const badgeOrderActionsClass = `badge-order-actions flex flex-wrap gap-2 ${mobileStackButtonClass} [&_button]:min-h-8 [&_button]:px-2.5`
export const teamAdminGridClass = 'team-admin-grid grid grid-cols-2 gap-3.5 max-[860px]:grid-cols-1 max-[720px]:min-w-0 max-[560px]:grid-cols-[minmax(0,1fr)]'
export const teamReportLinkClass =
  'team-report-link inline-flex min-h-[34px] w-fit items-center justify-center gap-2 rounded-lg border border-[#a1e3cb]/25 px-2.5 py-[7px] text-[0.84rem] font-extrabold text-[#d6f6ea] no-underline hover:border-[#a1e3cb]/50 hover:bg-[#a1e3cb]/[0.08]'
export const historyFieldLinkClass =
  'history-field-link w-fit text-[0.76rem] font-black normal-case text-[#f4d59a] hover:text-[#fff7e6]'
export const historyFieldActionClass =
  'history-field-action grid gap-1.5 text-[0.82rem] font-extrabold uppercase text-[#b4bcbb]'
export const datetimeLocalFieldClass =
  'datetime-local-field grid min-h-10 min-w-0 w-full grid-cols-[minmax(0,1fr)_auto] items-center overflow-hidden rounded-md border border-white/[0.18] bg-[#121417] transition-[border-color,box-shadow] focus-within:border-[#e4b45e] focus-within:shadow-[0_0_0_1px_rgba(228,180,94,0.2)] data-[invalid=true]:border-[#d94f3d]/[0.92] data-[invalid=true]:shadow-[0_0_0_1px_rgba(217,79,61,0.22)]'
export const datetimeLocalZoneClass =
  'datetime-local-zone inline-grid min-w-[52px] self-stretch place-items-center border-l border-white/[0.14] bg-white/[0.05] px-2.5 text-[0.72rem] font-black tracking-normal text-[#d8d5cb]'
export const fieldErrorClass = 'field-error text-[0.76rem] font-extrabold leading-tight normal-case text-[#ffb4a8]'
export const historyAdminEventClass = `${adminSectionClass} history-admin-event mt-4`
export const memberLineClass = 'member-line text-[0.94rem]'
export const lorePanelClass =
  'lore-panel mt-[18px] grid gap-2.5 rounded-lg border border-[#e4b45e]/40 bg-[#e4b45e]/[0.10] p-[clamp(18px,3vw,28px)] [&_span]:text-[0.78rem] [&_span]:font-black [&_span]:uppercase [&_span]:text-[#e4b45e] [&_p]:whitespace-pre-wrap [&_p]:text-[clamp(1.15rem,2vw,1.5rem)] [&_p]:leading-[1.45] [&_p]:text-[#fff7e6]'
export const legendDetailMainClass =
  'legend-detail-main mx-auto grid min-w-0 w-[min(1180px,calc(100%_-_32px))] gap-[18px] py-7 pb-[54px] max-[1023px]:w-[min(100%_-_24px,1180px)] max-[1023px]:py-[18px] max-[1023px]:pb-[42px] max-[480px]:w-[min(100%_-_18px,1180px)]'
export const legendBackLinkClass =
  'legend-back-link mb-2.5 inline-flex min-h-[30px] w-fit items-center gap-1.5 rounded-full border border-[#e4b45e]/[0.36] bg-[#e4b45e]/[0.10] px-2.5 text-[0.78rem] font-black uppercase text-[#f4d59a] hover:bg-[#e4b45e]/[0.18] hover:text-[#fff7e6]'
export const legendDetailHeroClass =
  `${eventHeroClass} compact-hero legend-detail-hero grid-cols-[minmax(0,1fr)_minmax(160px,240px)] items-center overflow-hidden max-[1023px]:grid-cols-[minmax(0,1fr)]`
export function legendDetailTrophyClass(isBiolab: boolean) {
  return `legend-detail-trophy grid aspect-[1122/1402] w-[min(100%,210px)] place-items-center self-center justify-self-center [--legend-trophy-float-distance:-10px] [animation:legend-trophy-float_5.4s_ease-in-out_infinite] [filter:drop-shadow(0_20px_30px_rgba(0,0,0,0.32))_drop-shadow(0_0_24px_rgba(228,180,94,0.28))] [&_img]:block [&_img]:h-full [&_img]:w-full [&_img]:object-contain ${isBiolab ? 'legend-detail-trophy-biolab' : ''}`
}
export const legendDetailScorePanelClass =
  'legend-detail-score-panel grid grid-cols-[minmax(220px,0.7fr)_minmax(0,1fr)] items-center gap-[18px] rounded-lg border border-[#e4b45e]/[0.32] bg-[radial-gradient(circle_at_18%_24%,rgba(71,191,143,0.11),transparent_34%),linear-gradient(145deg,rgba(30,34,38,0.92),rgba(18,20,23,0.96))] p-[clamp(18px,3vw,28px)] max-[1023px]:grid-cols-[minmax(0,1fr)] [&>div:first-child_span]:text-[0.76rem] [&>div:first-child_span]:font-black [&>div:first-child_span]:uppercase [&>div:first-child_span]:text-[#e4b45e] [&_h2]:mt-1.5 [&_h2]:mb-0 [&_h2]:text-[clamp(3rem,8vw,6.4rem)] [&_h2]:leading-[0.9] [&_h2]:text-[#f8e4a9]'
export const legendDetailScoreListClass =
  'legend-detail-score-list grid gap-2 [&_div]:grid [&_div]:min-h-[38px] [&_div]:grid-cols-[minmax(0,1fr)_auto] [&_div]:items-center [&_div]:gap-3 [&_div]:rounded-[7px] [&_div]:border [&_div]:border-white/10 [&_div]:bg-white/[0.055] [&_div]:px-2.5 [&_div]:py-2 [&_div.winner]:border-[#f8e4a9]/70 [&_div.winner]:bg-[#e4b45e]/[0.16] [&_span]:min-w-0 [&_span]:overflow-hidden [&_span]:text-ellipsis [&_span]:whitespace-nowrap [&_span]:font-[850] [&_span]:text-[#d8dedc] [&_strong]:text-[1.35rem] [&_strong]:leading-none [&_strong]:text-[#f8e4a9]'
export const legendRoundHistoryClass =
  'legend-round-history grid gap-3.5 [&_h2]:m-0'
export const legendRoundTrackClass =
  'legend-round-track flex gap-0 overflow-x-auto overscroll-x-contain px-0.5 pb-3 pt-1 [scroll-snap-type:x_proximity] max-[1023px]:[-webkit-overflow-scrolling:touch]'
export const legendRoundNodeClass =
  'legend-round-node relative grid min-h-32 flex-[0_0_clamp(280px,42vw,340px)] gap-[7px] rounded-lg border border-[#e4b45e]/[0.28] bg-[radial-gradient(circle_at_50%_0%,rgba(228,180,94,0.13),transparent_48%),rgba(255,255,255,0.055)] p-3.5 [scroll-snap-align:start] [&:not(:last-child)]:mr-[42px] [&:not(:last-child)::after]:absolute [&:not(:last-child)::after]:left-[calc(100%+8px)] [&:not(:last-child)::after]:top-1/2 [&:not(:last-child)::after]:h-0.5 [&:not(:last-child)::after]:w-[26px] [&:not(:last-child)::after]:bg-[linear-gradient(90deg,rgba(228,180,94,0.68),rgba(228,180,94,0.18))] [&:not(:last-child)::after]:content-[\'\'] [&_span]:text-[0.76rem] [&_span]:font-black [&_span]:uppercase [&_span]:text-[#e4b45e] [&_strong]:whitespace-nowrap [&_strong]:text-[clamp(1.35rem,4vw,2rem)] [&_strong]:leading-none [&_strong]:text-[#f8e4a9] [&_small]:m-0 [&_small]:text-[0.78rem] [&_small]:leading-[1.4] [&_small]:text-[#c0c8c6]'
export const legendRosterMatchupClass =
  'legend-roster-matchup grid grid-cols-2 items-start gap-3.5 max-[1023px]:grid-cols-[minmax(0,1fr)]'
export function legendRosterPanelClass(winner = false) {
  return `legend-roster-panel grid min-w-0 gap-3.5 rounded-lg border p-[clamp(16px,2.5vw,22px)] max-[720px]:px-[clamp(14px,4vw,18px)] ${winner ? 'winner border-[#f8e4a9]/[0.74] bg-[linear-gradient(150deg,rgba(228,180,94,0.15),rgba(255,255,255,0.045)),rgba(18,20,23,0.94)] shadow-[inset_0_0_0_1px_rgba(248,228,169,0.14)]' : 'border-white/[0.12] bg-white/[0.05]'}`
}
export const legendRosterHeadingClass =
  'legend-roster-heading grid min-w-0 gap-[5px] [&_span]:text-[0.76rem] [&_span]:font-black [&_span]:uppercase [&_span]:text-[#e4b45e] [&_h2]:m-0 [&_h2]:[overflow-wrap:anywhere]'
export const legendTeamRosterBlockClass =
  'legend-team-roster-block grid gap-2 [&_h3]:m-0 [&_h3]:text-base [&_h3]:text-[#f4f0e8]'
export function legendTeamReportLinkClass(compact = false) {
  return `legend-team-report-link inline-flex w-fit items-center justify-center gap-[7px] rounded-full border border-[#a1e3cb]/25 bg-[#a1e3cb]/[0.07] px-2.5 text-[0.78rem] font-black text-[#d6f6ea] no-underline hover:border-[#a1e3cb]/[0.48] hover:bg-[#a1e3cb]/[0.12] hover:text-[#f1fff8] ${compact ? 'compact min-h-7 flex-none px-2 text-[0.72rem]' : 'min-h-8'}`
}
export const legendRosterListClass =
  'legend-roster-list m-0 grid list-none gap-2 p-0 [&_li]:grid [&_li]:min-h-[42px] [&_li]:grid-cols-[minmax(0,1fr)_auto] [&_li]:items-center [&_li]:gap-2.5 [&_li]:rounded-[7px] [&_li]:border [&_li]:border-white/[0.09] [&_li]:bg-white/[0.06] [&_li]:px-[11px] [&_li]:py-[9px] [&_a]:min-w-0 [&_a]:overflow-hidden [&_a]:text-ellipsis [&_a]:whitespace-nowrap [&_a]:font-[850] [&_a]:text-[#f4f0e8] [&_a:hover]:text-[#f8e4a9] [&_small]:text-[0.7rem] [&_small]:font-black [&_small]:uppercase [&_small]:text-[#e4b45e]'
export const legendArchiveLinkPanelClass =
  'legend-archive-link-panel flex min-w-0 items-center justify-between gap-3.5 rounded-lg border border-[#e4b45e]/[0.28] bg-[linear-gradient(145deg,rgba(228,180,94,0.09),rgba(255,255,255,0.035)),rgba(255,255,255,0.045)] p-4 max-[720px]:grid max-[720px]:grid-cols-[minmax(0,1fr)] max-[720px]:items-start [&>div]:grid [&>div]:min-w-0 [&>div]:gap-[5px] [&_span]:text-[0.76rem] [&_span]:font-black [&_span]:uppercase [&_span]:text-[#e4b45e] [&_h2]:m-0 [&_h2]:text-[#fff7e6] [&_h2]:[overflow-wrap:anywhere]'
export const legendDataSectionClass =
  'legend-data-section grid gap-3.5'
export const legendSectionHeadingClass =
  'legend-section-heading flex min-w-0 items-end justify-between gap-3.5 max-[860px]:grid max-[860px]:items-start max-[720px]:grid-cols-[minmax(0,1fr)] [&_span]:text-[0.76rem] [&_span]:font-black [&_span]:uppercase [&_span]:text-[#e4b45e] [&_h2]:m-0 [&_h2]:text-[clamp(1.25rem,2vw,1.7rem)] [&_h2]:text-[#fff7e6]'
export const legendDraftReplayClass =
  'legend-draft-replay grid gap-3.5 rounded-lg border border-white/[0.11] bg-white/[0.045] p-[clamp(14px,2vw,18px)] max-[720px]:px-[clamp(14px,4vw,18px)]'
export const legendDraftControlsClass =
  'legend-draft-controls flex flex-wrap items-center gap-2 [&_button]:min-h-[34px] [&_button]:px-2.5 [&>span]:ml-auto [&>span]:text-[0.78rem] [&>span]:font-black [&>span]:uppercase [&>span]:text-[#b4bcbb] max-[860px]:[&>span]:ml-0 max-[860px]:[&>span]:w-full'
export const legendDraftTimelineClass =
  'legend-draft-timeline flex gap-[7px] overflow-x-auto px-0.5 pb-2.5 pt-0.5 [scroll-snap-type:x_proximity] max-[1023px]:[-webkit-overflow-scrolling:touch]'
export function legendDraftTimelineButtonClass(active: boolean) {
  return `grid min-h-9 w-9 flex-[0_0_36px] place-items-center rounded-full border p-0 tabular-nums [scroll-snap-align:start] ${active ? 'active border-[#f0c878] bg-[#f0c878] text-[#121417]' : 'border-white/[0.14] bg-white/[0.06] text-[#d8dedc] hover:not-disabled:border-[#f0c878] hover:not-disabled:bg-[#f0c878] hover:not-disabled:text-[#121417]'}`
}
export const legendDraftCurrentClass =
  'legend-draft-current grid grid-cols-[minmax(220px,0.85fr)_minmax(0,1.15fr)] items-stretch gap-3.5 max-[1023px]:grid-cols-[minmax(0,1fr)] max-[860px]:grid-cols-1'
export const legendDraftPickCardClass =
  'legend-draft-pick-card grid gap-3 rounded-lg border border-white/[0.11] bg-white/[0.055] p-4 [&>span]:text-[0.76rem] [&>span]:font-black [&>span]:uppercase [&>span]:text-[#e4b45e] [&_h3]:m-0 [&_h3]:text-[clamp(1.4rem,4vw,2.35rem)] [&_h3]:leading-none [&_h3]:text-[#fff7e6] [&_h3]:[overflow-wrap:anywhere] [&_h3_a:hover]:text-[#f8e4a9] [&_dl]:m-0 [&_dl]:grid [&_dl]:grid-cols-3 [&_dl]:gap-2 max-[860px]:[&_dl]:grid-cols-1 [&_dl_div]:grid [&_dl_div]:min-w-0 [&_dl_div]:gap-[3px] [&_dl_div]:rounded-[7px] [&_dl_div]:bg-white/[0.06] [&_dl_div]:p-[9px] [&_dt]:text-[0.68rem] [&_dt]:font-black [&_dt]:uppercase [&_dt]:text-[#8a9896] [&_dd]:m-0 [&_dd]:overflow-hidden [&_dd]:text-ellipsis [&_dd]:whitespace-nowrap [&_dd]:font-black [&_dd]:text-[#f8e4a9]'
export const legendDraftProcessClass =
  'legend-draft-process m-0 grid list-none gap-0 rounded-lg border border-white/[0.11] bg-white/[0.055] p-0 [&_li]:grid [&_li]:gap-1 [&_li]:px-[15px] [&_li]:py-[13px] [&_li+li]:border-t [&_li+li]:border-white/[0.09] [&_strong]:text-[0.8rem] [&_strong]:uppercase [&_strong]:text-[#f0c878] [&_span]:leading-[1.45] [&_span]:text-[#d8dedc]'
export const legendDraftStateClass =
  'legend-draft-state grid grid-cols-2 items-start gap-3.5 max-[1023px]:grid-cols-[minmax(0,1fr)] max-[860px]:grid-cols-1 [&_article]:grid [&_article]:min-w-0 [&_article]:content-start [&_article]:self-start [&_article]:grid-rows-[auto_auto_minmax(0,1fr)] [&_article]:gap-3 [&_article]:rounded-lg [&_article]:border [&_article]:border-white/[0.11] [&_article]:bg-white/[0.055] [&_article]:p-3.5 [&_dl]:m-0 [&_dl]:grid [&_dl]:grid-cols-2 [&_dl]:gap-2 [&_dl]:self-start [&_dl_div]:grid [&_dl_div]:min-w-0 [&_dl_div]:gap-[3px] [&_dl_div]:rounded-[7px] [&_dl_div]:bg-white/[0.06] [&_dl_div]:p-[9px] [&_dt]:text-[0.68rem] [&_dt]:font-black [&_dt]:uppercase [&_dt]:text-[#8a9896] [&_dd]:m-0 [&_dd]:overflow-hidden [&_dd]:text-ellipsis [&_dd]:whitespace-nowrap [&_dd]:font-black [&_dd]:text-[#f8e4a9] [&_ul]:m-0 [&_ul]:grid [&_ul]:list-none [&_ul]:content-start [&_ul]:gap-[7px] [&_ul]:p-0 [&_li]:grid [&_li]:min-h-9 [&_li]:grid-cols-[minmax(0,1fr)_auto] [&_li]:items-center [&_li]:gap-2 [&_li]:rounded-[7px] [&_li]:bg-white/[0.055] [&_li]:px-2.5 [&_li]:py-2 max-[720px]:[&_li]:grid-cols-[minmax(0,1fr)] [&_li_a]:overflow-hidden [&_li_a]:text-ellipsis [&_li_a]:whitespace-nowrap [&_li_a]:font-[850] [&_li_a]:text-[#f4f0e8] [&_li_a:hover]:text-[#f8e4a9] [&_li_small]:whitespace-nowrap [&_li_small]:text-[0.72rem] [&_li_small]:font-black [&_li_small]:text-[#e4b45e] max-[860px]:[&_li_small]:whitespace-normal'
export const legendDraftTeamHeadingClass =
  'legend-draft-team-heading flex min-w-0 justify-between gap-3 max-[860px]:grid max-[860px]:items-start [&_h3]:m-0 [&_h3]:overflow-hidden [&_h3]:text-ellipsis [&_h3]:whitespace-nowrap [&_h3]:text-[#fff7e6] [&_span]:flex-none [&_span]:text-[0.76rem] [&_span]:font-black [&_span]:uppercase [&_span]:text-[#b4bcbb]'
export const legendRatingTableWrapClass =
  'legend-rating-table-wrap overflow-x-auto rounded-lg border border-white/[0.11] bg-white/[0.045] max-[1023px]:max-w-full max-[1023px]:[-webkit-overflow-scrolling:touch]'
export const legendRatingTableClass =
  'legend-rating-table min-w-[780px] max-[720px]:min-w-[680px] [&_th]:bg-white/[0.045] [&_td]:align-middle [&_td:first-child_a]:block [&_td:first-child_a]:font-black [&_td:first-child_a]:text-[#f4f0e8] [&_td:first-child_a:hover]:text-[#f8e4a9] [&_td_strong]:block [&_td_strong]:tabular-nums [&_td_strong]:text-[#f8e4a9] [&_td_small]:mt-1 [&_td_small]:block [&_td_small]:text-[0.72rem] [&_td_small]:font-black [&_td_small]:uppercase [&_td_small]:text-[#9aa5a3]'
export const legendRatingSpecsClass =
  'legend-rating-specs flex flex-wrap gap-1.5 [&_span]:inline-flex [&_span]:min-h-6 [&_span]:max-w-full [&_span]:items-center [&_span]:whitespace-normal [&_span]:rounded-full [&_span]:border [&_span]:border-white/[0.12] [&_span]:bg-white/[0.06] [&_span]:px-2 [&_span]:text-[0.72rem] [&_span]:font-black [&_span]:leading-[1.25] [&_span]:text-[#d8dedc] [&_span]:[overflow-wrap:anywhere]'
export const legendMutedClass = 'legend-muted text-[#8a9896]'
export const legendRatingEmptyClass = 'legend-rating-empty p-[18px] font-extrabold text-[#c0c8c6]'
export const overlayPageClass =
  'overlay-page grid min-h-screen w-full [place-items:end_stretch] p-0'
export const overlayPanelClass =
  'overlay grid min-h-[150px] grid-cols-[minmax(0,1fr)_auto] items-center gap-6 border-t-[3px] border-[#e4b45e] bg-[rgba(10,12,14,0.88)] px-9 py-6 max-[860px]:grid-cols-1 max-[720px]:min-h-0 max-[720px]:gap-3.5 max-[720px]:p-[clamp(14px,4vw,24px)] [&>div]:min-w-0 [&_h1]:text-[3.4rem] max-[720px]:[&_h1]:text-[clamp(1.8rem,10vw,3.4rem)] [&_p]:font-black [&_p]:uppercase [&_p]:text-[#e4b45e]'
export const overlayScoreClass =
  'overlay-score grid min-w-0 grid-cols-[repeat(2,minmax(0,220px))] gap-3 max-[860px]:grid-cols-1 max-[720px]:grid-cols-[repeat(2,minmax(0,1fr))] max-[480px]:grid-cols-1 [&_article]:flex [&_article]:min-w-0 [&_article]:items-center [&_article]:justify-between [&_article]:gap-3 [&_article]:rounded-lg [&_article]:bg-white/[0.08] [&_article]:p-3.5 [&_span]:min-w-0 [&_span]:overflow-hidden [&_span]:text-ellipsis [&_span]:whitespace-nowrap [&_strong]:flex-none [&_strong]:text-5xl [&_strong]:text-[#e4b45e] max-[720px]:[&_strong]:text-[clamp(2rem,11vw,3rem)]'
export const legendsMainClass =
  'legends-main m-0 grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)] gap-[18px] overflow-hidden p-0'
export const legendsHeroClass =
  `${eventHeroClass} compact-hero legends-hero mx-auto w-[min(1180px,calc(100%_-_32px))] overflow-hidden !pt-[clamp(12px,2vh,24px)] !pb-[clamp(8px,1.5vh,16px)]`
export const legendCarouselSectionClass =
  'legend-carousel-section m-0 grid min-h-0 overflow-visible p-0'
export const legendCarouselClass =
  'legend-carousel grid h-full min-h-[min(780px,100%)] grid-flow-col auto-cols-[minmax(280px,390px)] items-center gap-[18px] overflow-x-auto overflow-y-hidden overscroll-x-contain px-[max(4px,calc((100vw_-_390px)_/_2))] pt-[clamp(42px,6vh,78px)] pb-[clamp(78px,11vh,132px)] [scrollbar-width:none] [scroll-padding-inline:max(16px,calc((100vw_-_390px)_/_2))] [scroll-snap-type:x_proximity] [&.wheel-scrolling]:[scroll-snap-type:none] [&::-webkit-scrollbar]:hidden max-[1023px]:[-webkit-overflow-scrolling:touch] max-[860px]:auto-cols-[minmax(260px,84vw)] max-[860px]:px-[8vw] max-[860px]:pt-[38px] max-[860px]:pb-[74px] max-[860px]:[scroll-padding-inline:8vw]'
export function legendCardClass(focused: boolean) {
  const focusedClass = focused
    ? 'focused border-[#f8e4a9]/[0.92] opacity-100 shadow-[0_30px_66px_rgba(0,0,0,0.38),0_0_38px_rgba(228,180,94,0.3),inset_0_0_0_1px_rgba(248,228,169,0.3)] [transform:scale(1.025)] hover:[transform:translateY(-3px)_scale(1.04)] focus-visible:[transform:translateY(-3px)_scale(1.04)]'
    : 'opacity-[0.74] [transform:scale(0.93)]'
  return `legend-card relative isolate grid h-[clamp(400px,calc(100dvh_-_350px),530px)] min-h-0 grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-[clamp(9px,1.4vh,14px)] overflow-hidden rounded-lg border border-[#e4b45e]/50 bg-[radial-gradient(circle_at_50%_24%,rgba(248,228,169,0.22),transparent_30%),linear-gradient(150deg,rgba(76,62,32,0.96),rgba(26,31,31,0.98)_62%),#161a1a] p-[clamp(14px,2vh,20px)] text-[#f4f0e8] shadow-[0_22px_44px_rgba(0,0,0,0.24),inset_0_0_0_1px_rgba(248,228,169,0.12)] transition-[border-color,opacity,box-shadow,transform] [transition-duration:160ms] [scroll-snap-align:center] hover:border-[#f8e4a9]/[0.88] hover:opacity-90 hover:shadow-[0_28px_58px_rgba(0,0,0,0.34),0_0_34px_rgba(228,180,94,0.24),inset_0_0_0_1px_rgba(248,228,169,0.26)] hover:[transform:translateY(-4px)_scale(0.96)] focus-visible:border-[#f8e4a9]/[0.88] focus-visible:opacity-90 focus-visible:shadow-[0_28px_58px_rgba(0,0,0,0.34),0_0_34px_rgba(228,180,94,0.24),inset_0_0_0_1px_rgba(248,228,169,0.26)] focus-visible:[transform:translateY(-4px)_scale(0.96)] max-[860px]:h-[clamp(380px,calc(100dvh_-_245px),500px)] ${focusedClass}`
}
export const legendCardShineClass =
  'legend-card-shine pointer-events-none absolute -left-[38%] -top-[60%] z-[-1] h-[220%] w-[64%] rotate-[20deg] bg-[linear-gradient(90deg,transparent,rgba(255,247,220,0.18),transparent)] [animation:legend-card-shine_6.8s_ease-in-out_infinite]'
export const legendCardTitleClass =
  'legend-card-title grid min-w-0 gap-1.5 text-center [&_time]:text-[0.76rem] [&_time]:font-black [&_time]:uppercase [&_time]:text-[#f0c878] [&_h2]:m-0 [&_h2]:text-[clamp(1.35rem,2vw,2.05rem)] [&_h2]:leading-[1.02] [&_h2]:text-[#fff7e6]'
export function legendTrophyClass(isBiolab: boolean) {
  return `legend-trophy mt-1.5 grid aspect-[1122/1402] place-items-center self-center justify-self-center [--legend-trophy-float-distance:-4px] [animation:legend-trophy-float_5.4s_ease-in-out_infinite] [filter:drop-shadow(0_20px_30px_rgba(0,0,0,0.32))_drop-shadow(0_0_24px_rgba(228,180,94,0.28))] [&_img]:block [&_img]:h-full [&_img]:w-full [&_img]:object-contain ${isBiolab ? 'legend-trophy-biolab w-[min(76%,clamp(150px,24dvh,230px))]' : 'w-[min(70%,clamp(140px,22dvh,210px))]'} max-[860px]:w-[min(68%,clamp(130px,20dvh,190px))]`
}
export const legendScoreboardClass =
  'legend-scoreboard grid gap-2 [&_div]:grid [&_div]:min-h-[38px] [&_div]:grid-cols-[minmax(0,1fr)_auto] [&_div]:items-center [&_div]:gap-3 [&_div]:rounded-[7px] [&_div]:border [&_div]:border-white/10 [&_div]:bg-white/[0.055] [&_div]:px-2.5 [&_div]:py-2 [&_div.winner]:border-[#f8e4a9]/70 [&_div.winner]:bg-[#e4b45e]/[0.16] [&_span]:min-w-0 [&_span]:overflow-hidden [&_span]:text-ellipsis [&_span]:whitespace-nowrap [&_span]:font-[850] [&_span]:text-[#d8dedc] [&_strong]:text-[1.35rem] [&_strong]:leading-none [&_strong]:text-[#f8e4a9]'
export const legendCardWinnerClass =
  'legend-card-winner grid min-w-0 gap-1 border-t border-[#e4b45e]/[0.22] pt-2.5 text-center [&_span]:text-[0.76rem] [&_span]:font-black [&_span]:uppercase [&_span]:text-[#e4b45e] [&_strong]:overflow-hidden [&_strong]:text-ellipsis [&_strong]:whitespace-nowrap [&_strong]:text-[clamp(1rem,1.6vw,1.2rem)] [&_strong]:text-[#fff7e6]'
const historyFormLabelClass =
  '[&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.82rem] [&_label]:font-extrabold [&_label]:uppercase [&_label]:text-[#b4bcbb]'
const historyFormControlClass =
  '[&_input]:min-h-10 [&_input]:w-full [&_input]:min-w-0 [&_input]:rounded-md [&_input]:border [&_input]:border-white/[0.18] [&_input]:bg-[#121417] [&_input]:px-2.5 [&_input]:font-semibold [&_input]:normal-case [&_input]:text-[#f4f0e8] [&_input]:transition-colors [&_select]:min-h-10 [&_select]:w-full [&_select]:min-w-0 [&_select]:rounded-md [&_select]:border [&_select]:border-white/[0.18] [&_select]:bg-[#121417] [&_select]:px-2.5 [&_select]:font-semibold [&_select]:normal-case [&_select]:text-[#f4f0e8] [&_select]:transition-colors'
const historyDatetimeControlClass =
  '[&_.datetime-local-field_input]:min-h-[38px] [&_.datetime-local-field_input]:rounded-none [&_.datetime-local-field_input]:border-0 [&_.datetime-local-field_input]:bg-transparent [&_.datetime-local-field_input]:shadow-none [&_.datetime-local-field_input:focus-visible]:border-transparent [&_.datetime-local-field_input:focus-visible]:outline-0'
export const historyAdminGridClass =
  `history-admin-grid grid grid-cols-3 items-end gap-3 max-[860px]:grid-cols-1 max-[720px]:min-w-0 max-[560px]:grid-cols-[minmax(0,1fr)] ${historyFormLabelClass} ${historyFormControlClass} ${historyDatetimeControlClass}`
export const historyAddTeamRowClass = `${historyAdminGridClass} add-team-row border-t border-white/10 pt-3.5`
export const historyFullFieldClass =
  `full-field grid gap-1.5 text-[0.82rem] font-extrabold uppercase text-[#b4bcbb] [&_textarea]:min-h-[150px] [&_textarea]:w-full [&_textarea]:min-w-0 [&_textarea]:resize-y [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:border-white/[0.18] [&_textarea]:bg-[#121417] [&_textarea]:p-2.5 [&_textarea]:font-semibold [&_textarea]:normal-case [&_textarea]:text-[#f4f0e8] [&_textarea]:transition-colors`
export const historyTeamGridClass =
  'history-team-grid grid grid-cols-2 gap-3 max-[860px]:grid-cols-1 max-[720px]:min-w-0 max-[560px]:grid-cols-[minmax(0,1fr)]'
export function historyTeamClass(winner: boolean) {
  return `history-team grid min-w-0 content-start gap-2 rounded-lg border border-white/10 bg-white/[0.05] p-3.5 ${winner ? 'winner border-[#47bf8f]/[0.46]' : ''} ${historyFormLabelClass} [&_input]:min-h-10 [&_input]:w-full [&_input]:min-w-0 [&_input]:rounded-md [&_input]:border [&_input]:border-white/[0.18] [&_input]:bg-[#121417] [&_input]:px-2.5 [&_input]:font-semibold [&_input]:normal-case [&_input]:text-[#f4f0e8] [&_input]:transition-colors`
}
export const historyTeamTitleClass =
  'history-team-title flex items-center justify-between gap-2.5 [&_h3]:m-0 [&_h3]:text-base [&_span]:text-[0.74rem] [&_span]:font-black [&_span]:uppercase [&_span]:text-[#bff0db]'
export const fieldRowClass =
  'field-row grid grid-cols-[repeat(auto-fit,minmax(92px,1fr))] gap-2.5 [&_.side-field]:min-w-[min(100%,140px)]'
export const embedColorIndicatorClass =
  'embed-color-indicator grid gap-2 text-[0.82rem] font-extrabold text-[#b4bcbb] [&>span]:uppercase'
export const embedColorIndicatorOptionsClass =
  'embed-color-indicator-options grid gap-1.5 text-[0.82rem] font-bold text-[#d8dedc] [&_span]:flex [&_span]:items-center [&_span]:gap-2 [&_i]:h-2.5 [&_i]:w-2.5 [&_i]:flex-none [&_i]:rounded-full [&_i[data-state=open]]:bg-[#47bf8f] [&_i[data-state=closing]]:bg-[#e4b45e] [&_i[data-state=closed]]:bg-[#d94f3d]'
export const psbAccountResultsClass =
  'psb-account-results absolute left-0 right-0 top-[calc(100%+4px)] z-20 overflow-hidden rounded-md border border-white/[0.18] bg-[#121417] normal-case shadow-[0_16px_30px_rgba(0,0,0,0.35)]'
export const psbAccountResultButtonClass =
  'grid w-full items-start justify-stretch justify-items-start gap-0.5 rounded-none border-0 border-b border-white/[0.08] bg-transparent px-2.5 py-[9px] text-left text-[#f4f0e8] hover:bg-[#e4b45e]/[0.14] focus-visible:bg-[#e4b45e]/[0.14] last:border-b-0 [&_span]:text-[0.78rem] [&_span]:font-bold [&_span]:text-[#9aa4a1] [&_strong]:text-[0.88rem] [&_strong]:text-[#fff7e6]'
export const psbAccountEmptyClass = 'psb-account-empty p-2.5 text-[0.78rem] font-bold text-[#9aa4a1]'

export const teamGridClass = 'team-grid grid min-w-0 grid-cols-2 gap-4 max-[720px]:grid-cols-1'
export const compactTeamGridClass = `${teamGridClass} mt-[18px]`
export const teamPanelClass =
  'team-panel grid min-w-0 grid-rows-[36px_88px_54px_minmax(0,1fr)_auto] gap-3.5 rounded-lg border border-white/[0.10] bg-[rgba(30,34,38,0.86)] p-[18px] transition-colors [&_dl]:self-start [&_dl]:gap-3 [&_dt]:min-h-[18px] [&_dt]:whitespace-nowrap [&_dt]:text-[0.68rem] [&_dd]:text-[1.05rem] [&_dd]:leading-[1.1] [&_dd]:tabular-nums'
export const activeTeamPanelClass = `${teamPanelClass} border-[#47bf8f]/50 shadow-[0_0_0_1px_rgba(71,191,143,0.12)]`
export const summaryTeamPanelClass =
  'team-panel summary-team-panel grid min-w-0 grid-rows-[auto_auto_auto] gap-3.5 overflow-hidden rounded-lg border border-white/[0.10] bg-[rgba(30,34,38,0.86)] p-0 transition-colors'
export function summaryTeamPanelWithFactionClass(faction?: string | null) {
  if (faction === 'VS') return `${summaryTeamPanelClass} team-panel-vs border-[#9660ff]/35 bg-[linear-gradient(135deg,rgba(150,96,255,0.06),transparent_60%),#13171a]`
  if (faction === 'NC') return `${summaryTeamPanelClass} team-panel-nc border-[#47bf8f]/35 bg-[linear-gradient(135deg,rgba(71,191,143,0.06),transparent_60%),#13171a]`
  if (faction === 'TR') return `${summaryTeamPanelClass} team-panel-tr border-[#d94f3d]/35 bg-[linear-gradient(135deg,rgba(217,79,61,0.06),transparent_60%),#13171a]`
  return summaryTeamPanelClass
}
export const summaryTeamHeadingClass =
  'summary-team-heading flex items-start justify-between gap-3 bg-white/[0.035] px-4 py-3.5 [&_h2]:m-0 [&_h2]:flex-1 [&_h2]:text-base [&_h2]:font-black'
export function teamFactionChipClass(faction: string) {
  if (faction === 'VS') return 'team-faction-chip faction-vs inline-flex items-center rounded-full border border-[#9660ff]/50 bg-[#9660ff]/[0.14] px-2 py-0.5 text-[0.72rem] font-black text-[#bda1ff]'
  if (faction === 'NC') return 'team-faction-chip faction-nc inline-flex items-center rounded-full border border-[#47bf8f]/50 bg-[#47bf8f]/[0.14] px-2 py-0.5 text-[0.72rem] font-black text-[#8de2bd]'
  return 'team-faction-chip faction-tr inline-flex items-center rounded-full border border-[#d94f3d]/50 bg-[#d94f3d]/[0.14] px-2 py-0.5 text-[0.72rem] font-black text-[#f28f83]'
}
export const teamLiveScoreClass = 'team-live-score text-[2.4rem] leading-none text-[#e4b45e]'
export const teamRosterGridClass = 'team-roster-grid grid grid-cols-2 gap-1.5 px-3.5 py-3 max-[720px]:grid-cols-1 max-[560px]:grid-cols-[minmax(0,1fr)]'
export const teamRosterMemberClass =
  'team-roster-member flex min-w-0 items-center justify-between gap-2 rounded-md bg-white/[0.05] px-2.5 py-[7px] [&_a]:min-w-0 [&_a]:overflow-hidden [&_a]:text-ellipsis [&_a]:whitespace-nowrap [&_a]:text-[0.85rem] [&_a]:font-bold [&_a]:text-[#f0ece3] [&_a:hover]:text-[#f8e4a9] [&_small]:flex-none [&_small]:text-[0.68rem] [&_small]:font-black [&_small]:uppercase [&_small]:text-[#e4b45e]'
export const teamBudgetGridClass = 'team-budget-grid grid grid-cols-2 gap-2 px-4 py-3 max-[720px]:grid-cols-1'
export const teamBudgetCardClass =
  'team-budget-card grid min-w-0 gap-[3px] rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 [&_span]:text-[0.68rem] [&_span]:font-black [&_span]:uppercase [&_span]:text-[#8a9896] [&_strong]:min-w-0 [&_strong]:overflow-hidden [&_strong]:text-ellipsis [&_strong]:whitespace-nowrap [&_strong]:text-base [&_strong]:font-black [&_strong]:text-[#f0ece3]'
export const playerCardClass =
  'player-card grid min-h-[82px] min-w-0 grid-cols-[minmax(0,1fr)_minmax(72px,96px)_auto] items-center gap-3.5 overflow-hidden rounded-lg border border-white/[0.10] bg-[rgba(30,34,38,0.86)] p-3.5 max-[720px]:grid-cols-1 max-[720px]:auto-rows-min max-[720px]:items-start [&>button]:justify-self-end max-[720px]:[&>button]:justify-self-stretch [&>span]:min-w-0 [&>span]:overflow-hidden [&>span]:text-right [&>span]:font-black [&>span]:tabular-nums [&>span]:text-ellipsis [&>span]:text-[#e4b45e] max-[720px]:[&>span]:text-left [&_small]:block [&_small]:text-[#b4bcbb]'
export const draftPlayerNameClass =
  'player-name min-w-0 overflow-hidden [&_strong]:block [&_strong]:min-w-0 [&_strong]:overflow-hidden [&_strong]:text-ellipsis [&_strong]:whitespace-nowrap'
export const draftPlayerNameRowClass =
  'player-name-row flex min-w-0 items-center gap-2 [&_a]:min-w-0 [&_a]:overflow-hidden'
export const playerSpecsClass =
  'player-specs mt-1.5 flex min-w-0 flex-wrap gap-1.5 overflow-visible [&_span]:inline-flex [&_span]:min-h-[22px] [&_span]:max-w-full [&_span]:items-center [&_span]:whitespace-normal [&_span]:rounded-full [&_span]:border [&_span]:border-white/[0.12] [&_span]:bg-white/[0.06] [&_span]:px-2 [&_span]:text-[0.72rem] [&_span]:font-black [&_span]:leading-tight [&_span]:text-[#d8dedc] [&_span]:[overflow-wrap:anywhere]'
export const eligibilityClass =
  'eligibility col-[1/-1] flex min-w-0 max-w-full flex-wrap justify-end gap-1.5 overflow-hidden max-[720px]:col-auto max-[720px]:justify-start'
export function eligibilityChipClass(status: 'budget' | 'combined' | 'blocked') {
  const tone =
    status === 'budget'
      ? 'budget border-[#47bf8f]/50 bg-[#47bf8f]/[0.13]'
      : status === 'combined'
        ? 'combined border-[#e4b45e]/50 bg-[#e4b45e]/[0.13]'
        : 'blocked border-[#d94f3d]/55 bg-[#d94f3d]/[0.12]'
  return `eligibility-chip inline-flex min-h-[30px] max-w-full items-center gap-1.5 rounded-full border px-[9px] ${tone} [&_strong]:text-[0.72rem] [&_small]:min-w-0 [&_small]:overflow-hidden [&_small]:text-ellipsis [&_small]:whitespace-nowrap [&_small]:text-[0.72rem] [&_small]:text-[#d8dedc]`
}

export const ratingsPanelClass =
  'panel mt-[18px] first:mt-0 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-white/[0.10] bg-white/[0.055] p-[clamp(18px,3vw,28px)] max-[720px]:px-[clamp(14px,4vw,18px)]'
export const responsivePlayerTableClass =
  'table-wrap responsive-player-table max-w-full overflow-x-auto rounded-lg border border-white/[0.10] bg-white/[0.045] pb-2 lg:overflow-visible lg:pb-0 [&_a]:font-black [&_a]:text-[#f4f0e8] [&_a:hover]:text-[#f8e4a9] [&_table]:w-full [&_table]:min-w-[520px] [&_table]:border-collapse [&_tbody_tr:nth-child(even)]:bg-white/[0.025] [&_tbody_tr:hover]:bg-white/[0.045] [&_td]:border-b [&_td]:border-white/[0.08] [&_td]:px-3 [&_td]:py-3.5 [&_td]:text-left [&_th]:border-b [&_th]:border-white/[0.08] [&_th]:px-3 [&_th]:py-3.5 [&_th]:text-left [&_th]:text-[0.78rem] [&_th]:uppercase [&_th]:text-[#b4bcbb] max-[720px]:overflow-visible max-[720px]:pb-0 max-[720px]:[&_table]:block max-[720px]:[&_table]:min-w-0 max-[720px]:[&_table]:border-separate max-[720px]:[&_table]:[border-spacing:0_10px] max-[720px]:[&_thead]:absolute max-[720px]:[&_thead]:h-px max-[720px]:[&_thead]:w-px max-[720px]:[&_thead]:overflow-hidden max-[720px]:[&_thead]:whitespace-nowrap max-[720px]:[&_thead]:[clip:rect(0_0_0_0)] max-[720px]:[&_tbody]:block max-[720px]:[&_tr]:block max-[720px]:[&_tr]:min-w-0 max-[720px]:[&_tr]:rounded-lg max-[720px]:[&_tr]:border max-[720px]:[&_tr]:border-white/10 max-[720px]:[&_tr]:bg-white/[0.045] max-[720px]:[&_tr]:p-3 max-[720px]:[&_th]:block max-[720px]:[&_th]:w-full max-[720px]:[&_th]:min-w-0 max-[720px]:[&_td]:grid max-[720px]:[&_td]:w-full max-[720px]:[&_td]:min-w-0 max-[720px]:[&_td]:grid-cols-[minmax(0,1fr)_auto] max-[720px]:[&_td]:items-center max-[720px]:[&_td]:gap-3 max-[720px]:[&_td]:border-b-0 max-[720px]:[&_td]:px-0 max-[720px]:[&_td]:py-1.5 max-[720px]:[&_td::before]:text-[0.72rem] max-[720px]:[&_td::before]:font-black max-[720px]:[&_td::before]:uppercase max-[720px]:[&_td::before]:text-[#8a9896] max-[720px]:[&_td::before]:content-[attr(data-label)]'
export const ratingHeaderActionsClass = 'rating-header-actions flex items-center gap-2.5 max-[640px]:w-full max-[640px]:flex-wrap max-[520px]:grid max-[520px]:grid-cols-1 max-[520px]:items-stretch max-[520px]:[&>*]:w-full'
export const ratingRaterSelectClass =
  'rating-rater-select flex items-center gap-2 text-[0.78rem] font-black uppercase text-[#b4bcbb] max-[640px]:w-full max-[520px]:min-w-[min(100%,260px)] max-[520px]:flex-[1_1_220px] [&_select]:min-h-[34px] [&_select]:min-w-[180px] [&_select]:rounded-full [&_select]:border [&_select]:border-white/[0.14] [&_select]:bg-white/[0.06] [&_select]:py-0 [&_select]:pl-3 [&_select]:pr-[34px] [&_select]:font-[inherit] [&_select]:normal-case [&_select]:text-[#fff7e6] [&_select:disabled]:text-[#d8dedc] [&_select:disabled]:opacity-100 max-[640px]:[&_select]:min-w-0 max-[640px]:[&_select]:flex-1'
export const ratingAdminWarningClass =
  'rating-admin-warning mb-[18px] rounded-lg border border-[#ff5c5c]/[0.68] bg-[#8e1212]/[0.34] px-3.5 py-3 text-[0.9rem] font-extrabold leading-[1.35] text-[#ffd6d6]'
export const ratingLegendClass = 'rating-legend mb-[18px] rounded-lg border border-white/[0.10] bg-white/[0.04] px-4 py-3.5'
export const ratingLegendTitleClass = 'rating-legend-title mb-2.5 text-[0.78rem] font-black uppercase text-[#b4bcbb]'
export const ratingLegendScaleClass = 'rating-legend-scale flex flex-wrap gap-x-[18px] gap-y-2 max-[860px]:flex-col max-[860px]:gap-1 [&_span]:text-[0.88rem] [&_span]:text-[#cbd5d3] [&_strong]:mr-1 [&_strong]:text-[#e4b45e]'
export const ratingLegendNoteClass = 'rating-legend-note mt-2.5 text-[0.85rem] font-bold text-[#f6d99f]'
export const ratingListToolbarClass =
  'rating-list-toolbar mb-3 flex items-center justify-between gap-3 max-[640px]:flex-col max-[640px]:items-start max-[520px]:flex-wrap max-[520px]:items-stretch max-[520px]:[&>*]:w-full [&>span]:text-[0.78rem] [&>span]:font-black [&>span]:uppercase [&>span]:text-[#b4bcbb]'
export const ratingSortControlClass =
  'rating-sort-control flex flex-wrap justify-end gap-1.5 max-[640px]:justify-start max-[520px]:grid max-[520px]:grid-cols-2 max-[520px]:[&_button]:w-full [&_button]:min-h-[34px] [&_button]:whitespace-nowrap [&_button]:border-white/[0.14] [&_button]:bg-white/[0.06] [&_button]:px-[11px] [&_button]:text-[#cbd5d3] [&_button:hover:not(:disabled)]:border-[#e4b45e]/[0.72] [&_button:hover:not(:disabled)]:bg-[#e4b45e]/[0.16] [&_button:hover:not(:disabled)]:text-[#fff7e6] [&_button.active]:border-[#e4b45e]/[0.72] [&_button.active]:bg-[#e4b45e]/[0.16] [&_button.active]:text-[#fff7e6]'
export const ratingListClass =
  'rating-list grid min-h-0 flex-1 auto-rows-max content-start gap-2.5 overflow-y-auto overflow-x-visible overscroll-contain pr-1.5 [overflow-anchor:none] max-[720px]:max-w-full max-[720px]:[-webkit-overflow-scrolling:touch]'
export const ratingRowClass =
  'rating-row flex items-center justify-between gap-3.5 rounded-lg border border-white/[0.10] bg-white/[0.06] px-3.5 py-3 transition-colors data-[rating-state=unrated]:border-[#e4b45e]/[0.72] data-[rating-state=unrated]:bg-[#e4b45e]/[0.14] data-[rating-state=unrated]:shadow-[inset_4px_0_0_#e4b45e] data-[rating-state=unrated]:[&_strong]:text-[#ffe1a3] max-[860px]:grid max-[860px]:justify-stretch max-[720px]:grid-cols-1 max-[720px]:items-start max-[720px]:gap-3 [&>strong]:min-w-0 [&>strong]:[overflow-wrap:anywhere]'
export const ratingControlsClass = 'rating-controls flex items-center gap-2 max-[860px]:justify-start max-[720px]:w-full'
export const ratingScorePickerClass =
  'rating-score-picker grid grid-cols-[repeat(10,32px)] gap-1 max-[860px]:grid-cols-[repeat(5,32px)] max-[720px]:w-[min(100%,380px)] max-[720px]:grid-cols-[repeat(5,minmax(38px,1fr))] max-[480px]:grid-cols-[repeat(5,minmax(32px,1fr))] [&_button]:min-h-8 [&_button]:w-8 [&_button]:rounded-md [&_button]:border-white/[0.14] [&_button]:bg-white/[0.06] [&_button]:p-0 [&_button]:tabular-nums [&_button]:text-[#d8dedc] max-[720px]:[&_button]:min-w-0 max-[480px]:[&_button]:min-h-9 [&_button:hover:not(:disabled)]:border-[#f0c878] [&_button:hover:not(:disabled)]:bg-[#f0c878] [&_button:hover:not(:disabled)]:text-[#121417] [&_button.active]:border-[#f0c878] [&_button.active]:bg-[#f0c878] [&_button.active]:text-[#121417]'
export const ratingAdjustmentGridClass =
  'rating-adjustment-grid grid min-w-0 grid-cols-[minmax(0,360px)] gap-2.5 [&>*]:min-w-0 [&_label]:grid [&_label]:min-w-0 [&_label]:gap-1.5 [&_label]:text-[0.82rem] [&_label]:font-extrabold [&_label]:uppercase [&_label]:text-[#b4bcbb] [&_.psb-account-combobox]:relative [&_.psb-account-combobox]:grid [&_.psb-account-combobox]:min-w-0 [&_.psb-account-combobox]:gap-1.5 [&_.psb-account-combobox]:text-[0.82rem] [&_.psb-account-combobox]:font-extrabold [&_.psb-account-combobox]:uppercase [&_.psb-account-combobox]:text-[#b4bcbb] [&_input]:min-h-10 [&_input]:w-full [&_input]:min-w-0 [&_input]:rounded-md [&_input]:border [&_input]:border-white/[0.18] [&_input]:bg-[#121417] [&_input]:px-2.5 [&_input]:font-semibold [&_input]:normal-case [&_input]:text-[#f4f0e8] [&_input]:transition-colors [&_select]:min-h-10 [&_select]:w-full [&_select]:min-w-0 [&_select]:rounded-md [&_select]:border [&_select]:border-white/[0.18] [&_select]:bg-[#121417] [&_select]:px-2.5 [&_select]:font-semibold [&_select]:normal-case [&_select]:text-[#f4f0e8] [&_select]:transition-colors'

export const playersHeaderClass = 'players-header flex flex-wrap items-end justify-between gap-4 px-0 pb-6 pt-[clamp(20px,4vw,48px)]'
export const playersViewToggleClass =
  'players-view-toggle flex shrink-0 gap-0.5 rounded-md border border-white/[0.08] bg-white/[0.05] p-[3px]'
export function playersViewToggleButtonClass(active: boolean) {
  const activeClass = active
    ? 'active border-white/[0.12] bg-[rgba(30,34,38,0.86)] font-extrabold text-[#f0ece3] shadow-[0_1px_3px_rgba(0,0,0,0.2)]'
    : 'border-transparent bg-transparent font-semibold text-[#8a9896]'
  return `flex h-[34px] cursor-pointer items-center gap-[7px] rounded-md border px-3.5 text-[0.84rem] transition-all ${activeClass}`
}
export const playersPanelClass =
  'panel players-panel mt-[18px] first:mt-0 grid min-w-0 gap-3.5 rounded-lg border border-white/[0.10] bg-white/[0.055] p-[clamp(18px,3vw,28px)] max-[720px]:px-[clamp(14px,4vw,18px)]'
export const playersToolbarClass = 'players-toolbar flex flex-wrap items-end gap-2.5 max-[1023px]:items-stretch'
export const playersSearchWrapClass = 'players-search-wrap relative flex-[1_1_200px]'
export const playersSearchIconClass = 'players-search-icon pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[#8a9896]'
export const playersSearchInputClass =
  'players-search-input h-[42px] w-full rounded-md border border-white/[0.12] bg-white/[0.05] pl-[38px] pr-3 text-[0.9rem] text-[#f0ece3]'
export const playersFilterSelectClass =
  'players-filter-select grid min-w-0 gap-1.5 text-[0.72rem] font-black uppercase tracking-[0.06em] text-[#8a9896] max-[1023px]:min-w-[min(100%,260px)] max-[1023px]:flex-[1_1_220px] [&_select]:h-[42px] [&_select]:min-w-[120px] [&_select]:cursor-pointer [&_select]:rounded-md [&_select]:border [&_select]:border-white/[0.18] [&_select]:bg-[#0e1012] [&_select]:px-3 [&_select]:text-[0.9rem] [&_select]:font-bold [&_select]:normal-case [&_select]:text-[#f0ece3]'
export const playersClearButtonClass =
  'players-clear-btn h-[42px] cursor-pointer whitespace-nowrap rounded-md border border-white/[0.14] bg-white/[0.06] px-3.5 font-bold text-[#c8d0ce] transition-all hover:border-[#e4b45e]/[0.72] hover:bg-[#e4b45e]/[0.16] hover:text-[#fff7e6]'
export const playersCountPillClass =
  'players-count-pill flex h-[42px] items-center whitespace-nowrap rounded-md border border-[#e4b45e]/35 bg-[#e4b45e]/[0.15] px-3.5 text-[0.82rem] font-black text-[#e4b45e]'
export const playersTableWrapClass = 'players-table-wrap overflow-x-auto overflow-y-hidden rounded-[10px] border border-white/[0.08]'
export const playersTableGridClass = 'grid min-w-[500px] grid-cols-[44px_minmax(180px,1fr)_64px_56px_130px] gap-3 max-[768px]:grid-cols-[34px_minmax(120px,1fr)_50px_46px_100px]'
export const playersTableHeaderClass =
  `players-table-header ${playersTableGridClass} items-center border-b border-white/[0.08] bg-white/[0.04] px-4 py-2.5`
export function playersTableRowClass(alt: boolean) {
  return `players-table-row ${playersTableGridClass} h-[68px] cursor-pointer items-center border-b border-white/[0.08] bg-transparent px-4 transition-colors last:border-b-0 hover:bg-[#e4b45e]/[0.05] ${alt ? 'alt bg-white/[0.015]' : ''}`
}
export function playersSortButtonClass(active: boolean) {
  return `players-sort-btn -ml-2 flex min-h-7 cursor-pointer items-center gap-1 rounded-md border border-transparent bg-transparent px-2 text-[0.72rem] font-black uppercase tracking-[0.06em] text-[#8a9896] hover:border-white/[0.14] hover:bg-white/[0.08] hover:text-white focus-visible:border-white/[0.14] focus-visible:bg-white/[0.08] focus-visible:text-white focus-visible:outline-none ${active ? 'active text-white' : ''}`
}
export const playersSortArrowClass = 'players-sort-arrow text-[0.6rem]'
export const playersTableNameCellClass = 'players-table-name-cell [&_strong]:text-[0.93rem] [&_strong]:font-extrabold [&_strong]:leading-[1.2] [&_strong]:text-[#f0ece3]'
export function playersTableStatClass(tone: 'neutral' | 'gold' | 'muted' = 'neutral') {
  const toneClass = tone === 'gold' ? 'gold text-[#e4b45e]' : tone === 'muted' ? 'muted text-[#8a9896]' : ''
  return `players-table-stat text-[0.88rem] font-extrabold ${toneClass}`
}
export const playersAvatarClass = 'players-avatar shrink-0 rounded-full object-cover'
export const playersAvatarInitialClass =
  `${playersAvatarClass} players-avatar-initial flex items-center justify-center border-[1.5px] border-[#e4b45e]/[0.32] bg-[radial-gradient(circle_at_35%_35%,rgba(228,180,94,0.19),rgba(228,180,94,0.06))] font-black text-[#e4b45e]`
export const playersBadgeRowClass = 'players-badge-row mt-1 flex flex-wrap gap-1'
export const playersBadgeChipClass =
  'players-badge-chip inline-flex items-center whitespace-nowrap rounded-full border border-[color-mix(in_srgb,var(--badge-color,#e4b45e)_38%,transparent)] bg-[color-mix(in_srgb,var(--badge-color,#e4b45e)_10%,transparent)] px-2 py-0.5 text-[0.72rem] font-black text-[color-mix(in_srgb,var(--badge-color,#e4b45e)_80%,white_20%)]'
export const playersBadgeOverflowClass = 'players-badge-overflow self-center text-[0.7rem] text-[#8a9896]'
export const playersRatingTbdClass = 'players-rating-tbd text-[0.82rem] font-bold text-[#8a9896]'
export const playersRatingBarClass = 'players-rating-bar flex items-center gap-2'
export const playersRatingTrackClass = 'players-rating-track h-1 flex-1 overflow-hidden rounded-sm bg-white/[0.08]'
export function playersRatingFillClass(tier: 'high' | 'mid' | 'low') {
  const toneClass = tier === 'high' ? 'high bg-[#47bf8f]' : tier === 'mid' ? 'mid bg-[#e4b45e]' : 'low bg-[#d94f3d]'
  return `players-rating-fill h-full rounded-sm ${toneClass}`
}
export function playersRatingValueClass(tier: 'high' | 'mid' | 'low') {
  const toneClass = tier === 'high' ? 'high text-[#47bf8f]' : tier === 'mid' ? 'mid text-[#e4b45e]' : 'low text-[#d94f3d]'
  return `players-rating-value min-w-7 text-right text-[0.82rem] font-black ${toneClass}`
}
export const playersCardGridClass = 'players-card-grid grid grid-cols-2 gap-3 max-[768px]:grid-cols-1'
export const playersCardClass =
  'players-card overflow-hidden rounded-[10px] border border-white/[0.08] bg-[#13171a] transition-[border-color,box-shadow] hover:border-[#e4b45e]/[0.32] hover:shadow-[0_0_0_1px_rgba(228,180,94,0.12),0_8px_24px_rgba(0,0,0,0.3)]'
export const playersCardBannerClass =
  "players-card-banner relative h-[72px] bg-[linear-gradient(135deg,rgba(228,180,94,0.1),rgba(150,96,255,0.08))] bg-cover bg-center after:absolute after:inset-0 after:bg-[linear-gradient(transparent_20%,#13171a)] after:content-['']"
export const playersCardBodyClass = 'players-card-body relative -mt-5 px-4 pb-4 pt-2.5'
export const playersCardIdentityClass = 'players-card-identity mb-2.5 flex min-w-0 items-end justify-between'
export const playersCardNameClass = 'players-card-name min-w-0 text-base font-black leading-[1.2] text-[#f0ece3] [&_.player-name-with-group]:max-w-full'
export const playersCardCatchphraseClass = 'players-card-catchphrase mt-1 min-w-0 text-[0.8rem] leading-[1.4] text-[#8a9896] [overflow-wrap:anywhere]'
export const playersCardStatsClass = 'players-card-stats mt-3 grid min-w-0 grid-cols-[repeat(3,minmax(0,1fr))] gap-1.5 max-[420px]:grid-cols-1'
export const playersCardStatClass = 'players-card-stat rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-2 text-center'
export const playersCardStatLabelClass = 'players-card-stat-label block text-[0.68rem] font-black uppercase tracking-[0.06em] text-[#8a9896]'
export function playersCardStatValueClass(gold = false) {
  return `players-card-stat-value mt-0.5 block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[0.92rem] font-black ${gold ? 'gold text-[#e4b45e]' : 'text-[#f0ece3]'}`
}
export const playersCardBadgesClass = 'players-card-badges mt-2.5 flex flex-wrap gap-1'

export const groupsHeaderClass =
  'groups-header flex flex-wrap items-end justify-between gap-[18px] px-0 pb-6 pt-[clamp(20px,4vw,48px)]'
export const groupsSearchWrapClass = 'groups-search-wrap flex-[0_1_320px]'
export const groupsSearchInputClass =
  'groups-search-input min-h-[42px] w-full rounded-md border border-white/[0.14] bg-white/[0.05] px-3 py-2.5 font-[inherit] text-[#f0ece3]'
export const groupsGridClass = 'groups-grid grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4'
export const groupCardClass =
  'group-card grid min-h-[260px] grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-white/[0.10] bg-[rgba(30,34,38,0.86)]'
export const groupCardMainClass = 'group-card-main grid min-w-0 content-start gap-4 p-[18px] [&_p]:min-w-0 [&_p]:[overflow-wrap:anywhere] [&_p]:text-[#c8d0ce] [&_p]:leading-[1.55]'
export const groupCardFooterClass =
  'group-card-footer flex min-h-[60px] min-w-0 flex-wrap items-center justify-start gap-2.5 border-t border-white/[0.08] bg-white/[0.035] px-[18px] py-3 [&>*]:min-w-0 [&>*]:max-w-full [&>*]:flex-[0_1_auto] [&_span]:text-[0.82rem] [&_span]:font-extrabold [&_span]:text-[#b4bcbb]'
export const groupTitleLineClass =
  'group-title-line mb-2 flex flex-wrap items-center gap-2.5 [&_h1]:min-w-0 [&_h1]:[overflow-wrap:anywhere] [&_h2]:min-w-0 [&_h2]:[overflow-wrap:anywhere]'
export const groupCountBadgeClass =
  'group-count-badge inline-flex min-h-[30px] items-center justify-center whitespace-nowrap rounded-full border border-[#e4b45e]/[0.42] bg-[#e4b45e]/[0.10] px-2.5 text-[0.78rem] font-black text-[#f3d99d]'
export const groupAdminPanelClass =
  'group-admin-create grid gap-4 rounded-lg border border-white/[0.10] bg-white/[0.055] p-[clamp(18px,3vw,28px)] mt-[18px] first:mt-0 mb-4 max-[720px]:px-[clamp(14px,4vw,18px)]'
export const groupRosterSectionClass =
  'group-roster-section grid gap-4 rounded-lg border border-white/[0.10] bg-white/[0.055] p-[clamp(18px,3vw,28px)] mt-[18px] first:mt-0 mb-4 max-[720px]:px-[clamp(14px,4vw,18px)]'
export const groupFormClass =
  'group-form grid grid-cols-[minmax(120px,0.5fr)_minmax(180px,1fr)_minmax(180px,1fr)] gap-3 max-[860px]:grid-cols-1 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.72rem] [&_label]:font-black [&_label]:uppercase [&_label]:text-[#8a9896] [&_input]:min-h-[42px] [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-white/[0.14] [&_input]:bg-white/[0.05] [&_input]:px-3 [&_input]:py-2.5 [&_input]:font-[inherit] [&_input]:text-[#f0ece3] [&_input[type=file]]:px-2.5 [&_input[type=file]]:py-2 [&_textarea]:min-h-[42px] [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:border-white/[0.14] [&_textarea]:bg-white/[0.05] [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:font-[inherit] [&_textarea]:text-[#f0ece3]'
export const groupFormHintClass = 'group-form-hint text-[0.72rem] font-extrabold leading-[1.35] normal-case text-[#b4bcbb]'
export const groupFormWideClass = 'group-form-wide col-span-full'
export const groupFormActionsClass = `group-form-actions col-span-full flex flex-wrap items-center justify-end gap-2 ${mobileStackChildrenClass}`
export const groupTagClass =
  'group-tag inline-flex min-h-[30px] min-w-11 max-w-full items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap rounded-md border border-[color-mix(in_srgb,var(--group-tag-color,#47bf8f)_62%,transparent)] bg-[color-mix(in_srgb,var(--group-tag-color,#47bf8f)_18%,transparent)] px-2 text-[0.82rem] font-black text-[color-mix(in_srgb,var(--group-tag-color,#47bf8f)_72%,white)]'
const groupLogoBaseClass =
  'group-logo flex-none rounded-lg border border-white/[0.14] bg-[#15191d]'
export function groupLogoClass(large = false) {
  return `${groupLogoBaseClass} ${large ? 'large h-28 w-28 max-[720px]:h-[88px] max-[720px]:w-[88px]' : 'h-[72px] w-[72px]'}`
}
export function groupLogoImageClass(large = false) {
  return `${groupLogoClass(large)} object-contain p-1.5`
}
export function groupLogoFallbackClass(large = false) {
  return `${groupLogoClass(large)} group-logo-fallback inline-flex items-center justify-center bg-[linear-gradient(135deg,rgba(228,180,94,0.18),transparent),rgba(71,191,143,0.12)] font-black text-[#f3d99d]`
}
export const groupAdminPickerClass =
  'group-admin-picker flex flex-wrap items-end justify-between gap-2 max-[860px]:justify-start [&_label]:grid [&_label]:flex-[1_1_260px] [&_label]:gap-1.5 [&_label]:text-[0.72rem] [&_label]:font-black [&_label]:uppercase [&_label]:text-[#8a9896] [&_select]:min-h-[42px] [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:border-white/[0.14] [&_select]:bg-white/[0.05] [&_select]:px-3 [&_select]:py-2.5 [&_select]:font-[inherit] [&_select]:text-[#f0ece3] [&_button]:min-h-[42px]'
export const groupHeroClass =
  'group-hero flex flex-wrap items-center justify-start gap-[18px] px-0 pb-6 pt-[clamp(20px,4vw,48px)] max-[560px]:grid [&>div]:grid [&>div]:min-w-0 [&>div]:flex-[1_1_320px] [&>div]:gap-2.5 [&_p]:text-[#c8d0ce] [&_p]:leading-[1.55]'
export const groupStatRowClass = 'group-stat-row flex flex-wrap items-center gap-2.5 [&_span]:text-[0.82rem] [&_span]:font-extrabold [&_span]:text-[#b4bcbb]'
export const groupRosterListClass = 'group-roster-list grid gap-2'
export const groupRosterRowClass =
  'group-roster-row flex min-h-[58px] items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-white/[0.035] px-3 py-2.5 max-[720px]:flex-col max-[720px]:items-start'
export const groupPlayerLinkClass =
  'group-player-link flex min-w-0 items-center gap-2.5 [&_strong]:min-w-0 [&_strong]:[overflow-wrap:anywhere] [&_img]:h-9 [&_img]:w-9 [&_img]:flex-none [&_img]:rounded-full [&_img]:object-cover'
export const groupPlayerAvatarFallbackClass =
  'group-player-avatar-fallback inline-flex h-9 w-9 flex-none items-center justify-center rounded-full border border-[#e4b45e]/[0.32] bg-[#e4b45e]/[0.08] font-black text-[#e4b45e]'
export const groupRowActionsClass = `group-row-actions flex flex-wrap items-center justify-end gap-2 max-[860px]:justify-start max-[720px]:w-full max-[720px]:max-w-full max-[720px]:justify-start ${mobileStackChildrenClass}`
export const draftLedgerStatsClass =
  'grid grid-cols-3 gap-2.5 m-0 max-[1280px]:grid-cols-1 max-[860px]:grid-cols-3 max-[560px]:grid-cols-1 [&>div]:grid [&>div]:min-w-0 [&>div]:gap-[3px] [&>div]:rounded-md [&>div]:bg-white/[0.06] [&>div]:p-2.5 [&_dt]:min-w-0 [&_dt]:overflow-hidden [&_dt]:text-ellipsis [&_dt]:whitespace-nowrap [&_dt]:text-[clamp(0.62rem,0.8vw,0.78rem)] [&_dt]:uppercase [&_dt]:text-[#b4bcbb] [&_dd]:mt-1 [&_dd]:min-w-0 [&_dd]:overflow-hidden [&_dd]:text-ellipsis [&_dd]:whitespace-nowrap [&_dd]:font-extrabold [&_dd]:text-[#f8e4a9]'
const panelShellClass =
  'panel min-w-0 rounded-lg border border-white/[0.10] bg-white/[0.055] p-[clamp(18px,3vw,28px)] max-[720px]:px-[clamp(14px,4vw,18px)]'
export const draftLayoutClass =
  'draft-layout grid h-[calc(100vh_-_138px)] min-h-0 min-w-0 grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] items-stretch gap-[18px] max-[860px]:h-auto max-[860px]:grid-cols-1 max-[720px]:min-w-0 max-[560px]:grid-cols-[minmax(0,1fr)]'
export function draftStatusClass(tone: string) {
  if (tone === 'ready') return 'draft-status ready inline-flex min-h-[30px] items-center whitespace-nowrap rounded-full border border-[#47bf8f]/[0.58] bg-[#47bf8f]/[0.16] px-2.5 text-[0.82rem] font-black text-[#bff0db]'
  if (tone === 'blocked') return 'draft-status blocked inline-flex min-h-[30px] items-center whitespace-nowrap rounded-full border border-[#d94f3d]/60 bg-[#d94f3d]/[0.15] px-2.5 text-[0.82rem] font-black text-[#f2b4ab]'
  return 'draft-status pending inline-flex min-h-[30px] items-center whitespace-nowrap rounded-full border border-[#e4b45e]/[0.58] bg-[#e4b45e]/[0.16] px-2.5 text-[0.82rem] font-black text-[#f6d99f]'
}
export const draftTeamsPanelClass =
  `${panelShellClass} draft-teams-panel mt-0 grid max-h-full min-h-0 content-stretch grid-rows-[auto_auto_auto_auto_minmax(0,1fr)] overflow-hidden [&_.team-grid]:min-h-0 [&_.team-grid]:items-stretch [&_.team-panel]:min-h-0 [&_.pick-list]:max-h-none [&_.pick-list]:min-h-0`
export const signupPoolPanelClass =
  `${panelShellClass} signup-pool-panel mt-0 grid max-h-full min-h-0 overflow-hidden grid-rows-[auto_auto_auto_auto_minmax(0,1fr)] max-[860px]:max-h-none max-[860px]:overflow-visible [&_.active-bid-panel]:row-[3] [&_.available-list]:row-[5] [&_.available-list]:min-h-0 [&_.available-list]:max-h-none [&_.available-list]:content-start [&_.available-list]:overflow-y-auto [&_.available-list]:[grid-auto-rows:minmax(82px,max-content)] max-[1023px]:[&_.available-list]:[grid-auto-rows:minmax(142px,max-content)] max-[860px]:[&_.available-list]:row-auto`
export const teamTitleRowClass =
  'team-title-row flex min-h-0 min-w-0 items-center justify-between gap-2.5 [&_h2]:m-0 [&_h2]:min-w-0 [&_h2]:overflow-hidden [&_h2]:text-ellipsis [&_h2]:whitespace-nowrap [&_h2]:leading-[1.15]'
export const teamMetaRowClass =
  'team-meta-row grid min-w-0 grid-cols-2 gap-2 [&_span]:grid [&_span]:min-w-0 [&_span]:content-center [&_span]:gap-[3px] [&_span]:rounded-md [&_span]:border [&_span]:border-white/10 [&_span]:bg-white/[0.05] [&_span]:px-2.5 [&_span]:py-2 [&_small]:text-[0.72rem] [&_small]:font-black [&_small]:uppercase [&_small]:text-[#b4bcbb] [&_strong]:min-w-0 [&_strong]:overflow-hidden [&_strong]:text-ellipsis [&_strong]:whitespace-nowrap'
export function factionFieldClass(faction?: string | null) {
  if (faction === 'VS') return 'faction-field faction-vs rounded-md border border-[#9660ff]/55 bg-[#9660ff]/[0.18] px-2.5 py-2'
  if (faction === 'TR') return 'faction-field faction-tr rounded-md border border-[#d94f3d]/55 bg-[#d94f3d]/[0.18] px-2.5 py-2'
  if (faction === 'NC') return 'faction-field faction-nc rounded-md border border-[#47bf8f]/55 bg-[#47bf8f]/[0.18] px-2.5 py-2'
  return 'faction-field rounded-md px-2.5 py-2'
}
export const pickTurnChipClass =
  'pick-turn-chip pick-turn-pulse inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded-full border border-[#47bf8f]/[0.58] bg-[#47bf8f]/[0.16] px-2.5 text-[0.76rem] font-black uppercase text-[#bff0db] [animation:pulse-glow_2s_ease-in-out_infinite]'
export const pickListClass =
  'pick-list m-0 grid max-h-[min(260px,34vh)] min-w-0 content-start gap-2 overflow-y-auto overscroll-contain py-0 pl-0 pr-1 [grid-auto-rows:max-content] [&_small]:block [&_small]:text-[#b4bcbb] [&_li]:flex [&_li]:min-w-0 [&_li]:items-center [&_li]:justify-between [&_li]:gap-3.5 [&_li]:rounded-md [&_li]:bg-white/[0.06] [&_li]:px-3 [&_li]:py-2.5 max-[560px]:[&_li]:grid max-[560px]:[&_li]:grid-cols-[minmax(0,1fr)] max-[560px]:[&_li]:justify-stretch [&_li.locked-pick]:border [&_li.locked-pick]:border-[#47bf8f]/35 [&_li.locked-pick]:bg-[#47bf8f]/[0.12] [&_li>button]:flex-none max-[560px]:[&_li>button]:w-full'
export const pickMainClass =
  'pick-main grid min-w-0 gap-0.5 [&_a]:min-w-0 [&_a]:overflow-hidden [&_a]:text-ellipsis [&_a]:whitespace-nowrap [&_span]:min-w-0 [&_span]:overflow-hidden [&_span]:text-ellipsis [&_span]:whitespace-nowrap'
export const captainPickNameClass =
  'captain-pick-name inline-flex max-w-full min-w-0 items-center gap-1.5 [&>span:first-child]:overflow-hidden [&>span:first-child]:text-ellipsis [&>span:first-child]:whitespace-nowrap'
export const captainCrownClass = 'captain-crown flex-none text-[0.92em] leading-none text-[#f4d59a]'
export const activeBidPanelClass =
  'active-bid-panel mb-4 grid min-w-0 gap-3 rounded-lg border border-[#e4b45e]/[0.32] bg-[#e4b45e]/[0.08] p-3.5 [&_a]:min-w-0 [&_a]:overflow-hidden [&_small]:text-[0.82rem] [&_small]:font-black [&_small]:uppercase [&_small]:text-[#b4bcbb] [&_strong]:block [&_strong]:min-w-0 [&_strong]:overflow-hidden [&_strong]:text-ellipsis [&_strong]:whitespace-nowrap [&_strong]:text-[1.05rem]'
export const bidInfoGridClass =
  'bid-info-grid grid min-w-0 grid-cols-[repeat(4,minmax(0,1fr))] gap-2.5 max-[1200px]:grid-cols-2 max-[860px]:grid-cols-1 [&>div]:grid [&>div]:min-w-0 [&>div]:gap-1'
export const bidActionsClass =
  `bid-actions flex min-w-0 flex-wrap items-center justify-end gap-2 ${mobileStackButtonClass} [&_button]:min-h-10 [&_button]:whitespace-nowrap`
export function availableListClass(empty: boolean) {
  return `available-list grid min-w-0 gap-3 pr-1.5 max-[560px]:max-w-full max-[560px]:[-webkit-overflow-scrolling:touch] ${empty ? 'available-list-empty content-center justify-items-center [&_.empty-inline]:max-w-[440px] [&_.empty-inline]:justify-center [&_.empty-inline]:text-center' : ''}`
}
export const specFilterRowClass =
  'spec-filter-row flex min-w-0 gap-2 overflow-x-auto py-2.5 pb-3 [scrollbar-width:thin]'
const specFilterButtonBaseClass =
  'flex-none rounded-full px-2.5 text-[0.76rem] font-black text-[#d8dedc] min-h-[30px] border-white/[0.14] bg-white/[0.06] hover:not-disabled:border-white/[0.14] hover:not-disabled:bg-white/[0.08] hover:not-disabled:text-[#fff7e6] focus-visible:border-white/[0.14] focus-visible:bg-white/[0.08] focus-visible:text-[#fff7e6]'
export function specFilterButtonClass(active: boolean) {
  return active
    ? `${specFilterButtonBaseClass} active border-[#e4b45e]/[0.48] bg-[#e4b45e]/[0.16] text-[#f4d59a] hover:not-disabled:border-[#e4b45e]/[0.48] hover:not-disabled:bg-[#e4b45e]/[0.16] hover:not-disabled:text-[#f4d59a] focus-visible:border-[#e4b45e]/[0.48] focus-visible:bg-[#e4b45e]/[0.16] focus-visible:text-[#f4d59a]`
    : specFilterButtonBaseClass
}
export const countChipClass =
  'count-chip inline-flex min-h-7 items-center whitespace-nowrap rounded-full border border-[#e4b45e]/40 bg-[#e4b45e]/[0.12] px-2.5 text-[0.76rem] font-black uppercase text-[#f4d59a]'
export const teamFooterChipsClass = 'team-footer-chips flex min-w-0 flex-wrap items-center gap-2'
export const teamCountChipClass = `${countChipClass} team-count-chip justify-center`
export const teamValueChipClass =
  'team-value-chip inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded-full border border-[#47bf8f]/40 bg-[#47bf8f]/[0.12] px-2.5 text-[0.76rem] font-black uppercase text-[#bff0db]'
export const headingWithChipClass = 'heading-with-chip flex min-w-0 flex-wrap items-center gap-2.5 [&_h2]:m-0 [&_h2]:min-w-0 [&_h2]:[overflow-wrap:anywhere]'
export const checkInPanelClass =
  'check-in-panel mt-3 flex min-w-0 items-center justify-between gap-3 rounded-md border border-white/[0.12] bg-white/[0.06] px-3 py-2.5 max-[560px]:grid max-[560px]:items-stretch [&>div]:grid [&>div]:min-w-0 [&>div]:gap-0.5 [&_button]:flex-none max-[560px]:[&_button]:w-full [&_small]:text-[0.76rem] [&_small]:font-extrabold [&_small]:text-[#b4bcbb] [&_strong]:text-[0.88rem]'
const checkInBadgeBaseClass =
  'check-in-badge box-border inline-flex max-w-max items-center justify-center gap-1 whitespace-nowrap rounded-full border border-white/[0.14] bg-white/[0.07] font-black uppercase leading-none text-[#d8dedc] [&_svg]:block [&_svg]:flex-none [&_svg]:stroke-[3px]'
const checkInBadgeToneClass = {
  checked: 'checked border-[#47bf8f]/50 bg-[#47bf8f]/[0.13] text-[#bff0db]',
  pending: 'pending border-[#e4b45e]/50 bg-[#e4b45e]/[0.13] text-[#f4d59a]',
  missing: 'missing border-[#d94f3d]/55 bg-[#d94f3d]/[0.12] text-[#f2b4ab]',
} as const
export function checkInBadgeClass(status: keyof typeof checkInBadgeToneClass, compact: boolean, iconOnly: boolean) {
  const sizeClass = compact
    ? iconOnly
      ? 'compact icon-only ml-1.5 h-[18px] min-h-[18px] w-[18px] min-w-[18px] flex-none p-0 text-[0.62rem] [&_svg]:h-2.5 [&_svg]:w-2.5'
      : 'compact ml-1.5 min-h-[18px] flex-none px-1.5 text-[0.62rem]'
    : iconOnly
      ? 'icon-only mt-1.5 h-5 min-h-5 w-5 min-w-5 overflow-hidden p-0 text-[0.68rem] [&_svg]:h-[11px] [&_svg]:w-[11px]'
      : 'mt-1.5 min-h-[22px] px-2 text-[0.68rem] [&_svg]:h-[11px] [&_svg]:w-[11px]'
  return `${checkInBadgeBaseClass} ${checkInBadgeToneClass[status]} ${sizeClass}`
}

export const coinflipCardClass = `coinflip-card grid min-w-0 content-start gap-3 [&_strong]:text-[#f4f0e8] [&_p]:m-0 [&_p]:text-[#b4bcbb] [&_small]:m-0 [&_small]:text-[#b4bcbb] ${adminFormLabelClass} ${adminFormControlClass}`

export const eventResultCardClass = `event-result-card grid min-w-0 content-start gap-3 [&_strong]:text-[#f4f0e8] [&_p]:m-0 [&_p]:text-[#b4bcbb] [&_small]:m-0 [&_small]:text-[#b4bcbb] ${adminFormLabelClass} ${adminFormControlClass} [&_textarea]:w-full [&_textarea]:min-w-0 [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:border-white/[0.18] [&_textarea]:bg-[#121417] [&_textarea]:px-2.5 [&_textarea]:font-semibold [&_textarea]:normal-case [&_textarea]:text-[#f4f0e8] [&_textarea]:transition-colors [&_textarea]:min-h-[92px] [&_textarea]:resize-y [&_textarea]:p-2.5 [&_input[aria-invalid=true]]:border-[#d94f3d]/[0.92] [&_select[aria-invalid=true]]:border-[#d94f3d]/[0.92] [&_textarea[aria-invalid=true]]:border-[#d94f3d]/[0.92] [&_input[aria-invalid=true]]:shadow-[0_0_0_1px_rgba(217,79,61,0.22)] [&_select[aria-invalid=true]]:shadow-[0_0_0_1px_rgba(217,79,61,0.22)] [&_textarea[aria-invalid=true]]:shadow-[0_0_0_1px_rgba(217,79,61,0.22)] [&_.checkbox-label]:flex [&_.checkbox-label]:items-center [&_.checkbox-label]:gap-2 [&_.checkbox-label]:normal-case [&_.checkbox-label_input]:min-h-[auto] [&_.checkbox-label_input]:w-auto [&_.role-combobox-control_input]:min-h-7 [&_.role-combobox-control_input]:w-[min(220px,100%)] [&_.role-combobox-control_input]:flex-[1_1_140px] [&_.role-combobox-control_input]:border-0 [&_.role-combobox-control_input]:bg-transparent [&_.role-combobox-control_input]:px-1 [&_.role-combobox-control_input]:py-0 [&_.role-combobox-control_input]:outline-0 [&_.color-picker-field_input[type=color]]:min-h-10 [&_.color-picker-field_input[type=color]]:w-[52px] [&_.color-picker-field_input[type=color]]:p-[3px] [&_.spec-emoji-trigger]:w-[72px] [&_.spec-emoji-trigger]:min-h-[42px] [&_.spec-emoji-trigger]:justify-center [&_.spec-emoji-trigger]:p-0 [&_.spec-checkbox-grid_.checkbox-field]:flex [&_.spec-checkbox-grid_.checkbox-field]:min-h-9 [&_.spec-checkbox-grid_.checkbox-field]:items-center [&_.spec-checkbox-grid_.checkbox-field]:gap-2 [&_.spec-checkbox-grid_.checkbox-field]:rounded-md [&_.spec-checkbox-grid_.checkbox-field]:border [&_.spec-checkbox-grid_.checkbox-field]:border-white/[0.12] [&_.spec-checkbox-grid_.checkbox-field]:bg-white/[0.04] [&_.spec-checkbox-grid_.checkbox-field]:px-2.5 [&_.spec-checkbox-grid_.checkbox-field]:normal-case [&_.spec-checkbox-grid_.checkbox-field]:text-[#d8dedc] [&_.spec-checkbox-grid_.checkbox-field_input]:min-h-[auto] [&_.spec-checkbox-grid_.checkbox-field_input]:w-auto ${datetimeControlClass}`
