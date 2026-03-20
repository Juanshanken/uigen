import { test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MainContent } from "../main-content";

// Mock complex providers/contexts so they just pass children through
vi.mock("@/lib/contexts/file-system-context", () => ({
  FileSystemProvider: ({ children }: any) => <div>{children}</div>,
  useFileSystem: vi.fn(),
}));

vi.mock("@/lib/contexts/chat-context", () => ({
  ChatProvider: ({ children }: any) => <div>{children}</div>,
  useChat: vi.fn(),
}));

// Mock leaf components to keep tests focused on toggle behavior
vi.mock("@/components/chat/ChatInterface", () => ({
  ChatInterface: () => <div data-testid="chat-interface">Chat</div>,
}));

vi.mock("@/components/editor/FileTree", () => ({
  FileTree: () => <div data-testid="file-tree">FileTree</div>,
}));

vi.mock("@/components/editor/CodeEditor", () => ({
  CodeEditor: () => <div data-testid="code-editor">CodeEditor</div>,
}));

vi.mock("@/components/preview/PreviewFrame", () => ({
  PreviewFrame: () => <div data-testid="preview-frame">PreviewFrame</div>,
}));

vi.mock("@/components/HeaderActions", () => ({
  HeaderActions: () => <div data-testid="header-actions">HeaderActions</div>,
}));

vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children }: any) => <div>{children}</div>,
  ResizablePanel: ({ children }: any) => <div>{children}</div>,
  ResizableHandle: () => <div />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("initially shows preview view", () => {
  render(<MainContent />);

  expect(screen.getByTestId("preview-frame")).toBeDefined();
  expect(screen.queryByTestId("code-editor")).toBeNull();
  expect(screen.queryByTestId("file-tree")).toBeNull();
});

test("clicking Code tab switches to code view", () => {
  render(<MainContent />);

  fireEvent.click(screen.getByText("Code"));

  expect(screen.queryByTestId("preview-frame")).toBeNull();
  expect(screen.getByTestId("code-editor")).toBeDefined();
  expect(screen.getByTestId("file-tree")).toBeDefined();
});

test("clicking Preview tab switches back to preview view", () => {
  render(<MainContent />);

  // Switch to code view first
  fireEvent.click(screen.getByText("Code"));
  expect(screen.queryByTestId("preview-frame")).toBeNull();

  // Switch back to preview
  fireEvent.click(screen.getByText("Preview"));

  expect(screen.getByTestId("preview-frame")).toBeDefined();
  expect(screen.queryByTestId("code-editor")).toBeNull();
  expect(screen.queryByTestId("file-tree")).toBeNull();
});

test("Preview tab is active by default", () => {
  render(<MainContent />);

  const previewTab = screen.getByText("Preview").closest("[data-slot='tabs-trigger']");
  expect(previewTab?.getAttribute("data-state")).toBe("active");

  const codeTab = screen.getByText("Code").closest("[data-slot='tabs-trigger']");
  expect(codeTab?.getAttribute("data-state")).toBe("inactive");
});

test("Code tab becomes active after clicking it", () => {
  render(<MainContent />);

  fireEvent.click(screen.getByText("Code"));

  const previewTab = screen.getByText("Preview").closest("[data-slot='tabs-trigger']");
  expect(previewTab?.getAttribute("data-state")).toBe("inactive");

  const codeTab = screen.getByText("Code").closest("[data-slot='tabs-trigger']");
  expect(codeTab?.getAttribute("data-state")).toBe("active");
});
