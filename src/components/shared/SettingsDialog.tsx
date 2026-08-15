import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SettingsView from "@/views/settings/SettingsView";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/** 设置弹窗：内容复用设置页（外观 / 数据管理 / 关于） */
export function SettingsDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
        </DialogHeader>
        <SettingsView />
      </DialogContent>
    </Dialog>
  );
}
