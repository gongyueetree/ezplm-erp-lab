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
    scenario: { code: 'NORMAL', enabled: true, latencyMs: 120, failureRate: 0 },
    requestLogs: [],
    auditLogs: [],
    mappingProfiles: [],
  }
}
