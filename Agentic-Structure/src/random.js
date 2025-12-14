import { PIECE_TYPES } from "./constants.js";

function shuffleInPlace(array, rng) {
  for (let index = array.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
  }
}

export class BagRandomizer {
  constructor({ rng = Math.random } = {}) {
    this.rng = rng;
    this.bag = [];
  }

  next() {
    if (this.bag.length === 0) {
      this.bag = [...PIECE_TYPES];
      shuffleInPlace(this.bag, this.rng);
    }
    return this.bag.pop();
  }
}

