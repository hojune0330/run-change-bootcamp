import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { Button } from "./Button"

describe("Button", () => {
  it("activates once from the keyboard when focused", async () => {
    // Given
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>기록 시작</Button>)

    // When
    await user.tab()
    await user.keyboard("{Enter}")

    // Then
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("does not activate when disabled", async () => {
    // Given
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        제출 완료
      </Button>,
    )

    // When
    await user.click(screen.getByRole("button", { name: "제출 완료" }))

    // Then
    expect(onClick).not.toHaveBeenCalled()
  })
})
