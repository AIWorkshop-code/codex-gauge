import { BellSimple, CaretDown, X } from "@phosphor-icons/react";

export function AnnouncementView() {
  const openOffer = () => window.codexQuota?.openMembershipOffer?.();
  const close = () => window.codexQuota?.closeAnnouncement?.();

  return (
    <main className="announcement-shell" role="dialog" aria-labelledby="announcement-title">
      <section className="announcement-card">
        <button className="announcement-close" type="button" aria-label="关闭公告" onClick={close}>
          <X size={18} weight="regular" />
        </button>
        <div className="announcement-copy">
          <h1 id="announcement-title">会员服务</h1>
          <p>需要 ChatGPT 会员？查看安全便捷的开通方案</p>
          <small><BellSimple size={13} weight="regular" />每天仅提示一次</small>
        </div>
        <button className="announcement-action" type="button" onClick={openOffer}>立即查看</button>
      </section>
      <CaretDown className="announcement-pointer" size={20} weight="fill" aria-hidden="true" />
    </main>
  );
}
