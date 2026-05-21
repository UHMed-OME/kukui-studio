/** Minimal valid config used as Studio's "new activity" template. */
const starter = {
  version: "1.0",
  title: "Categorization",
  prompt: "Sort each item into the correct category.",
  categories: [
    { id: "c1", label: "Category A" },
    { id: "c2", label: "Category B" },
  ],
  items: [
    { id: "i1", text: "Item 1", correctCategory: "c1" },
    { id: "i2", text: "Item 2", correctCategory: "c2" },
  ],
  behaviour: { enableRetry: true },
};

export default starter;
