import mixpanel from 'mixpanel';

const mp = mixpanel.init('f787e632a507ccd1838204b7b5ca70b3');
export function writeEvent(event: string, props?: { [key: string]: any }) {
  mp.track(event, props);
}
