import Soup from 'gi://Soup?version=3.0';
import GLib from 'gi://GLib';

let _session = null;

function _getSession() {
  if (!_session) _session = new Soup.Session({ timeout: 15 });
  return _session;
}

export function destroy() {
  _session?.abort();
  _session = null;
}

export function get(url) {
  return new Promise((resolve, reject) => {
    let message = Soup.Message.new('GET', url);

    _getSession().send_and_read_async(
      message,
      GLib.PRIORITY_DEFAULT,
      null,
      function (session, result) {
        try {
          let bytes = session.send_and_read_finish(result);
          // Read status_code directly. get_status() marshals through the
          // Soup.Status enum and throws on anything not in it, e.g. the 429
          // the price APIs return when they rate-limit us.
          let code = message.status_code;
          if (code !== 200) {
            reject(new Error(`HTTP ${code} for ${url}`));
            return;
          }
          let decoder = new TextDecoder('utf-8');
          resolve({
            code,
            body: decoder.decode(bytes.get_data()),
          });
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}
