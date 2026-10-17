// props: {"active":{"editor":"enum","options":["channels","guide","series","pair"],"default":"channels"},"signedIn":{"editor":"boolean","default":true},"$preview":{"width":1440,"height":80}}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { menu: false };
  }
  renderVals() {
    const active = this.props.active ?? 'channels';
    const signedIn = this.props.signedIn ?? true;
    const links = [
      ['channels', 'Canales', 'PubHome.dc.html'],
      ['guide', 'Guía', 'PubGuide.dc.html'],
      ['series', 'Series', 'PubCatalog.dc.html'],
      ['pair', 'Vincular TV', 'PubPair.dc.html']
    ].map(([key, label, href]) => {
      const on = key === active;
      return {
        label, href,
        current: on ? 'page' : 'false',
        style: 'display: inline-flex; align-items: center; min-height: 44px; padding: 0 14px; border-radius: 22px; text-decoration: none; font-size: 15px; '
          + (on ? 'color: #FFB547; background: #24231C; font-weight: 600;' : 'color: #D6D2C6;')
      };
    });
    return {
      links,
      signedIn,
      signedOut: !signedIn,
      menuOpen: signedIn && this.state.menu,
      toggleMenu: () => this.setState({ menu: !this.state.menu })
    };
  }
}
