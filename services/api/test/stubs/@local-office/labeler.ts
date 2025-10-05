export interface LabelInput {
  name: string;
  item: string;
  allergens: string[];
  orderId: string;
}

export interface LabelRenderResult {
  pdf: Buffer;
  zpl: string;
}

export async function generateBatchLabels(_batchId: string, labels: LabelInput[]): Promise<LabelRenderResult> {
  const pdf = Buffer.from(`labels:${labels.length}`);
  const zpl = labels.map((label) => label.item).join('\n');
  return { pdf, zpl };
}
