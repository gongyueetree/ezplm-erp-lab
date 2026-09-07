import type { SimulatorDataset } from '../types.js'

export function createSeedDataset(tenantId: string): SimulatorDataset {
  const now = new Date().toISOString()
  return {
    version: 1,
    tenantId,
    datasetName: 'ezPLM Golden Dataset v1',
    seededAt: now,
    materials: [
      { externalId: 'MAT-001', materialCode: 'EZ-STM32H743', internalPn: 'MCU-0001', manufacturer: 'STMicroelectronics', mpn: 'STM32H743VIT6', description: 'Cortex-M7 MCU, 2 MB Flash', unit: 'PCS', lifecycle: 'ACTIVE', status: 'ACTIVE', updatedAt: now },
      { externalId: 'MAT-002', materialCode: 'EZ-ADS131M04', internalPn: 'ADC-0007', manufacturer: 'Texas Instruments', mpn: 'ADS131M04IPWR', description: '4-channel 24-bit delta-sigma ADC', unit: 'PCS', lifecycle: 'ACTIVE', status: 'ACTIVE', updatedAt: now },
      { externalId: 'MAT-003', materialCode: 'EZ-USB-C-16P', internalPn: 'CON-0012', manufacturer: 'GCT', mpn: 'USB4105-GF-A', description: 'USB Type-C receptacle 16 pin', unit: 'PCS', lifecycle: 'ACTIVE', status: 'ACTIVE', updatedAt: now },
      { externalId: 'MAT-004', materialCode: 'EZ-R-10K-0402', internalPn: 'RES-0042', manufacturer: 'Yageo', mpn: 'RC0402FR-0710KL', description: '10 kΩ 1% resistor', unit: 'PCS', lifecycle: 'ACTIVE', status: 'ACTIVE', updatedAt: now },
      { externalId: 'MAT-005', materialCode: 'EZ-C-100N-0402', internalPn: 'CAP-0031', manufacturer: 'Murata', mpn: 'GRM155R71C104KA88D', description: '100 nF 16 V X7R capacitor', unit: 'PCS', lifecycle: 'ACTIVE', status: 'ACTIVE', updatedAt: now },
      { externalId: 'MAT-006', materialCode: 'EZ-TPS7A2033', internalPn: 'PMIC-0015', manufacturer: 'Texas Instruments', mpn: 'TPS7A2033PDBVR', description: '300 mA low-noise LDO', unit: 'PCS', lifecycle: 'ACTIVE', status: 'ACTIVE', updatedAt: now },
      { externalId: 'MAT-007', materialCode: 'EZ-W25Q128', internalPn: 'MEM-0008', manufacturer: 'Winbond', mpn: 'W25Q128JVSIQ', description: '128 Mbit SPI Flash', unit: 'PCS', lifecycle: 'ACTIVE', status: 'ACTIVE', updatedAt: now },
      { externalId: 'MAT-008', materialCode: 'EZ-SGM8301', internalPn: 'OPA-0022', manufacturer: 'SG Micro', mpn: 'SGM8301-1XN5G/TR', description: 'High-speed rail-to-rail op amp', unit: 'PCS', lifecycle: 'ACTIVE', status: 'ACTIVE', updatedAt: now },
    ],
    inventory: [
      { externalId: 'INV-001', materialCode: 'EZ-STM32H743', warehouseCode: 'SZ-RM', warehouseName: '苏州原材料仓', onHandQty: '1260', availableQty: '1200', reservedQty: '60', lotNo: 'L240812', updatedAt: now },
      { externalId: 'INV-002', materialCode: 'EZ-ADS131M04', warehouseCode: 'SZ-RM', warehouseName: '苏州原材料仓', onHandQty: '450', availableQty: '410', reservedQty: '40', lotNo: 'L240921', updatedAt: now },
      { externalId: 'INV-003', materialCode: 'EZ-USB-C-16P', warehouseCode: 'SZ-RM', warehouseName: '苏州原材料仓', onHandQty: '8200', availableQty: '7700', reservedQty: '500', updatedAt: now },
      { externalId: 'INV-004', materialCode: 'EZ-R-10K-0402', warehouseCode: 'SZ-RM', warehouseName: '苏州原材料仓', onHandQty: '86000', availableQty: '75500', reservedQty: '10500', updatedAt: now },
      { externalId: 'INV-005', materialCode: 'EZ-C-100N-0402', warehouseCode: 'SZ-RM', warehouseName: '苏州原材料仓', onHandQty: '63400', availableQty: '60100', reservedQty: '3300', updatedAt: now },
      { externalId: 'INV-006', materialCode: 'EZ-SGM8301', warehouseCode: 'SZ-RM', warehouseName: '苏州原材料仓', onHandQty: '90', availableQty: '65', reservedQty: '25', updatedAt: now },
    ],
    excess: [
      { externalId: 'EX-001', materialCode: 'EZ-STM32H743', customerCode: 'CUS-ACME', warehouseCode: 'SZ-EX', bookQty: '900', availableQty: '800', earliestInboundAt: '2026-07-16', sourceDocumentId: 'WO-2841', sourceUpdatedAt: now },
      { externalId: 'EX-002', materialCode: 'EZ-USB-C-16P', customerCode: 'CUS-NOVA', warehouseCode: 'SZ-EX', bookQty: '2500', availableQty: '2200', earliestInboundAt: '2026-08-03', sourceDocumentId: 'WO-2917', sourceUpdatedAt: now },
      { externalId: 'EX-003', materialCode: 'EZ-C-100N-0402', customerCode: 'CUS-ACME', warehouseCode: 'SZ-EX', bookQty: '12000', availableQty: '11800', earliestInboundAt: '2026-06-27', sourceDocumentId: 'WO-2702', sourceUpdatedAt: now },
    ],
    suppliers: [
      { externalId: 'SUP-001', supplierCode: 'SUP-DIGIKEY', name: 'DigiKey Electronics', status: 'ACTIVE', currency: 'USD', updatedAt: now },
      { externalId: 'SUP-002', supplierCode: 'SUP-MOUSER', name: 'Mouser Electronics', status: 'ACTIVE', currency: 'USD', updatedAt: now },
      { externalId: 'SUP-003', supplierCode: 'SUP-LCSC', name: 'LCSC Electronics', status: 'ACTIVE', currency: 'CNY', updatedAt: now },
      { externalId: 'SUP-004', supplierCode: 'SUP-SEEED', name: 'Seeed Studio', status: 'ACTIVE', currency: 'CNY', updatedAt: now },
    ],
    customers: [
      { externalId: 'CUS-001', customerCode: 'CUS-ACME', name: 'Acme Robotics (脱敏)', status: 'ACTIVE', updatedAt: now },
      { externalId: 'CUS-002', customerCode: 'CUS-NOVA', name: 'Nova Instruments (脱敏)', status: 'ACTIVE', updatedAt: now },
      { externalId: 'CUS-003', customerCode: 'CUS-ORBIT', name: 'Orbit Systems (脱敏)', status: 'ACTIVE', updatedAt: now },
    ],
    exchangeRates: [
      { baseCurrency: 'USD', quoteCurrency: 'CNY', rate: '7.1462', rateType: 'SPOT', effectiveDate: '2026-09-01', source: 'ERP_SIMULATOR' },
      { baseCurrency: 'EUR', quoteCurrency: 'CNY', rate: '8.3661', rateType: 'SPOT', effectiveDate: '2026-09-01', source: 'ERP_SIMULATOR' },
      { baseCurrency: 'CNY', quoteCurrency: 'USD', rate: '0.139934', rateType: 'SPOT', effectiveDate: '2026-09-01', source: 'ERP_SIMULATOR' },
    ],
    purchaseOrders: [
      { externalId: 'PO-EXT-001', poNumber: 'PO20260828001', supplierCode: 'SUP-DIGIKEY', currency: 'USD', orderDate: '2026-08-28', requestedDate: '2026-09-15', status: 'OPEN', lines: [{ lineNo: 1, materialCode: 'EZ-STM32H743', qty: '1000', unitPrice: '11.84', requestedDate: '2026-09-15', confirmedQty: '1000', eta: '2026-09-13' }] },
      { externalId: 'PO-EXT-002', poNumber: 'PO20260829002', supplierCode: 'SUP-LCSC', currency: 'CNY', orderDate: '2026-08-29', requestedDate: '2026-09-12', status: 'OPEN', lines: [{ lineNo: 1, materialCode: 'EZ-SGM8301', qty: '500', unitPrice: '4.20', requestedDate: '2026-09-12' }, { lineNo: 2, materialCode: 'EZ-USB-C-16P', qty: '3000', unitPrice: '1.86', requestedDate: '2026-09-12' }] },
    ],
    receipts: [],
    // LAB-1: 工单。consumedLines.materialCode 全部引用上方 materials；customerCode 引用 customers。
    // productCode 是成品编码（Lab 暂无成品主数据集，自由文本）；WO-2841/2917 与 excess 的 sourceDocumentId 对应。
    workOrders: [
      { externalId: 'WO-EXT-001', woNumber: 'WO-2841', customerCode: 'CUS-ACME', productCode: 'FG-ACME-CTRL-A1', bomRef: 'BOM-CTRL-A1-V3', qty: '300', status: 'COMPLETED', consumedLines: [{ materialCode: 'EZ-STM32H743', consumedQty: '300' }, { materialCode: 'EZ-R-10K-0402', consumedQty: '9600' }, { materialCode: 'EZ-C-100N-0402', consumedQty: '14400' }], plannedStart: '2026-07-01', plannedEnd: '2026-07-15' },
      { externalId: 'WO-EXT-002', woNumber: 'WO-2917', customerCode: 'CUS-NOVA', productCode: 'FG-NOVA-DAQ-M2', bomRef: 'BOM-DAQ-M2-V1', qty: '120', status: 'IN_PROGRESS', currentOperation: 'SMT 贴片', consumedLines: [{ materialCode: 'EZ-ADS131M04', consumedQty: '480' }, { materialCode: 'EZ-USB-C-16P', consumedQty: '120' }, { materialCode: 'EZ-TPS7A2033', consumedQty: '240' }], plannedStart: '2026-08-20', plannedEnd: '2026-09-18' },
      { externalId: 'WO-EXT-003', woNumber: 'WO-3006', customerCode: 'CUS-ORBIT', productCode: 'FG-ORBIT-SENSE-S1', bomRef: 'BOM-SENSE-S1-V2', qty: '500', status: 'PLANNED', consumedLines: [{ materialCode: 'EZ-SGM8301', consumedQty: '1000' }, { materialCode: 'EZ-W25Q128', consumedQty: '500' }], plannedStart: '2026-09-22', plannedEnd: '2026-10-10' },
    ],
    // LAB-1: 销售订单。customerCode 全部引用 customers；shippedQty ≤ qty。
    salesOrders: [
      { externalId: 'SO-EXT-001', soNumber: 'SO20260810001', customerCode: 'CUS-ACME', status: 'PARTIALLY_SHIPPED', lines: [{ lineNo: 1, productCode: 'FG-ACME-CTRL-A1', qty: '300', shippedQty: '200', requestedDate: '2026-09-30' }] },
      { externalId: 'SO-EXT-002', soNumber: 'SO20260825002', customerCode: 'CUS-NOVA', status: 'OPEN', lines: [{ lineNo: 1, productCode: 'FG-NOVA-DAQ-M2', qty: '120', shippedQty: '0', requestedDate: '2026-10-15' }, { lineNo: 2, productCode: 'FG-NOVA-DAQ-M2-SPARE', qty: '10', requestedDate: '2026-10-15' }] },
    ],
    scenario: { code: 'NORMAL', enabled: true, latencyMs: 120, failureRate: 0 },
    requestLogs: [],
    auditLogs: [],
    mappingProfiles: [],
  }
}
