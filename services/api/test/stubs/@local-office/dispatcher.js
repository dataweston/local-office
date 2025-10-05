class BaseAdapter {
  async quote() {
    throw new Error('Not implemented in test stub');
  }

  async create() {
    throw new Error('Not implemented in test stub');
  }

  async cancel() {
    throw new Error('Not implemented in test stub');
  }

  async parseWebhook() {
    throw new Error('Not implemented in test stub');
  }
}

class DispatchAdapter extends BaseAdapter {}
class UberDirectAdapter extends BaseAdapter {}
class OloAdapter extends BaseAdapter {}

module.exports = {
  DispatchAdapter,
  UberDirectAdapter,
  OloAdapter
};
