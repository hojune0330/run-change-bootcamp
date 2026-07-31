import { ChartLineUpIcon } from "@phosphor-icons/react/ChartLineUp"
import { ChatCircleIcon } from "@phosphor-icons/react/ChatCircle"
import { CheckSquareIcon } from "@phosphor-icons/react/CheckSquare"
import { ClipboardTextIcon } from "@phosphor-icons/react/ClipboardText"
import { HouseIcon } from "@phosphor-icons/react/House"
import { MegaphoneIcon } from "@phosphor-icons/react/Megaphone"
import { NotePencilIcon } from "@phosphor-icons/react/NotePencil"
import { UsersThreeIcon } from "@phosphor-icons/react/UsersThree"
import type { ReactNode } from "react"

export type NavigationItem = {
  readonly href: string
  readonly icon: ReactNode
  readonly label: string
}

export const PARTICIPANT_NAVIGATION = [
  {
    href: "/today",
    label: "오늘",
    icon: <HouseIcon aria-hidden size={20} weight="bold" />,
  },
  {
    href: "/feed",
    label: "함께",
    icon: <ChatCircleIcon aria-hidden size={20} weight="bold" />,
  },
  {
    href: "/record",
    label: "기록",
    icon: <NotePencilIcon aria-hidden size={20} weight="bold" />,
  },
  {
    href: "/change",
    label: "내 변화",
    icon: <ChartLineUpIcon aria-hidden size={20} weight="bold" />,
  },
] as const satisfies readonly NavigationItem[]

export const COACH_NAVIGATION = [
  {
    href: "/coach/cohort",
    label: "20명 현황",
    icon: <UsersThreeIcon aria-hidden size={20} weight="bold" />,
  },
  {
    href: "/coach/assignments",
    label: "과제",
    icon: <ClipboardTextIcon aria-hidden size={20} weight="bold" />,
  },
  {
    href: "/coach/feedback",
    label: "피드백",
    icon: <CheckSquareIcon aria-hidden size={20} weight="bold" />,
  },
  {
    href: "/coach/notices",
    label: "공지",
    icon: <MegaphoneIcon aria-hidden size={20} weight="bold" />,
  },
] as const satisfies readonly NavigationItem[]

export const NAVIGATION_BY_MODE = {
  participant: PARTICIPANT_NAVIGATION,
  coach: COACH_NAVIGATION,
} as const satisfies Record<string, readonly NavigationItem[]>

export type AppMode = keyof typeof NAVIGATION_BY_MODE

export const MODE_LABELS = {
  participant: "참여자 주요 메뉴",
  coach: "코치 주요 메뉴",
} as const satisfies Record<AppMode, string>

export const MODE_SWITCH_LINKS = {
  participant: { href: "/", label: "세션 바꾸기" },
  coach: { href: "/", label: "세션 바꾸기" },
} as const satisfies Record<AppMode, { readonly href: string; readonly label: string }>
