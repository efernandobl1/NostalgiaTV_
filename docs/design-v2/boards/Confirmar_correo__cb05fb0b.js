// props: {"variant":{"editor":"enum","options":["success","expired"],"default":"success"},"$preview":{"width":1440,"height":900}}
class Component extends DCLogic {
  renderVals() {
    const ok = (this.props.variant ?? 'success') === 'success';
    return { ok, expired: !ok, iconBg: ok ? '#1E2A1E' : '#3A3122' };
  }
}
