import { Soul, load } from "@opensouls/engine";

const soul: Soul = {
  name: "Evo",
  staticMemories: {
    core: load("./Evo.md")
  }
}

export default soul