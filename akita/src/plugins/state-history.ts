import { pairwise } from 'rxjs/operators';
import { Query } from '../api/query';
import { Store } from '../api/store';
import { getGlobalState } from '../internal/global-state';

const globalState = getGlobalState();

export class StateHistory<S = any, E = any> {
  private history = {
    past: [],
    present: null,
    future: []
  };

  private skipUpdate = false;
  private subscription;

  constructor(private query: Query<E>, private LIMIT = 10) {
    this.onInit();
  }

  get hasPast() {
    return this.history.past.length;
  }

  get hasFuture() {
    return this.history.future.length;
  }

  onInit() {
    this.history.present = this.getStore()._value();
    this.subscription = this.query
      .select(state => state)
      .pipe(pairwise())
      .subscribe(([past, present]) => {
        if (!this.skipUpdate) {
          if (this.history.past.length === this.LIMIT) {
            this.history.past = this.history.past.slice(1);
          }
          this.history.past = [...this.history.past, past];
          this.history.present = present;
        }
      });
  }

  undo() {
    if (this.history.past.length > 0) {
      const { past, present, future } = this.history;
      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);

      this.history.past = newPast;
      this.history.present = previous;
      this.history.future = [present, ...this.history.future];
      this.update();
    }
  }

  redo() {
    if (this.history.future.length > 0) {
      const { past, present, future } = this.history;
      const next = this.history.future[0];
      const newFuture = this.history.future.slice(1);
      this.history.past = [...past, present];
      this.history.present = next;
      this.history.future = newFuture;
      this.update('Redo');
    }
  }

  jumpToPast(index) {
    if (index < 0 || index >= this.history.past.length) return;

    const { past, future } = this.history;
    /**
     *
     * const past = [1, 2, 3, 4, 5];
     *
     * newPast = past.slice(0, 2) = [1, 2];
     * present = past[index] = 3;
     * [...past.slice(2 + 1), ...future] = [4, 5];
     *
     */
    const newPast = past.slice(0, index);
    const newFuture = [...past.slice(index + 1), ...future];
    const newPresent = past[index];
    this.history.past = newPast;
    this.history.present = newPresent;
    this.history.future = newFuture;
    this.update();
  }

  jumpToFuture(index) {
    if (index < 0 || index >= this.history.future.length) return;

    const { past, future } = this.history;

    const newPast = [...past, ...future.slice(0, index)];
    const newPresent = future[index];
    const newFuture = future.slice(index + 1);

    this.history.past = newPast;
    this.history.present = newPresent;
    this.history.future = newFuture;
    this.update('Redo');
  }

  clear() {
    this.history = {
      past: [],
      present: null,
      future: []
    };
  }

  destroy() {
    this.subscription.unsubscribe();
  }

  private update(action = 'Undo') {
    this.skipUpdate = true;
    globalState.setAction({ type: `@StateHistory - ${action}` });
    this.getStore().setState(() => this.history.present);
    this.skipUpdate = false;
  }

  getStore() {
    return this.query.__store__;
  }
}
