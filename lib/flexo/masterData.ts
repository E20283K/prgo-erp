import { FlexoCylinderData, FlexoMachine, FlexoMaterial } from "./types";

/**
 * Standard Cylinder & Gear Master Data extracted from:
 * JR-1521 Printing Cylinder and Gear Data Reference
 * Circular pitch: ~2.7107 mm, Plate thickness: 1.70 mm
 * Range: 40T to 149T (110 cylinder sizes)
 */
export const JR_1521_CYLINDERS: FlexoCylinderData[] = [
  {
    "teeth": 40,
    "pitchCircleDiameter": 34.51,
    "plateThickness": 1.7,
    "cylinderDiameter": 31.01,
    "filmLength": 99.13,
    "printingLength": 108.43
  },
  {
    "teeth": 41,
    "pitchCircleDiameter": 35.38,
    "plateThickness": 1.7,
    "cylinderDiameter": 31.88,
    "filmLength": 101.84,
    "printingLength": 111.14
  },
  {
    "teeth": 42,
    "pitchCircleDiameter": 36.24,
    "plateThickness": 1.7,
    "cylinderDiameter": 32.74,
    "filmLength": 104.55,
    "printingLength": 113.85
  },
  {
    "teeth": 43,
    "pitchCircleDiameter": 37.1,
    "plateThickness": 1.7,
    "cylinderDiameter": 33.6,
    "filmLength": 107.26,
    "printingLength": 116.56
  },
  {
    "teeth": 44,
    "pitchCircleDiameter": 37.96,
    "plateThickness": 1.7,
    "cylinderDiameter": 34.46,
    "filmLength": 109.97,
    "printingLength": 119.27
  },
  {
    "teeth": 45,
    "pitchCircleDiameter": 38.83,
    "plateThickness": 1.7,
    "cylinderDiameter": 35.33,
    "filmLength": 112.68,
    "printingLength": 121.98
  },
  {
    "teeth": 46,
    "pitchCircleDiameter": 39.69,
    "plateThickness": 1.7,
    "cylinderDiameter": 36.19,
    "filmLength": 115.39,
    "printingLength": 124.69
  },
  {
    "teeth": 47,
    "pitchCircleDiameter": 40.55,
    "plateThickness": 1.7,
    "cylinderDiameter": 37.05,
    "filmLength": 118.11,
    "printingLength": 127.4
  },
  {
    "teeth": 48,
    "pitchCircleDiameter": 41.42,
    "plateThickness": 1.7,
    "cylinderDiameter": 37.92,
    "filmLength": 120.82,
    "printingLength": 130.11
  },
  {
    "teeth": 49,
    "pitchCircleDiameter": 42.28,
    "plateThickness": 1.7,
    "cylinderDiameter": 38.78,
    "filmLength": 123.53,
    "printingLength": 132.82
  },
  {
    "teeth": 50,
    "pitchCircleDiameter": 43.14,
    "plateThickness": 1.7,
    "cylinderDiameter": 39.64,
    "filmLength": 126.24,
    "printingLength": 135.53
  },
  {
    "teeth": 51,
    "pitchCircleDiameter": 44.0,
    "plateThickness": 1.7,
    "cylinderDiameter": 40.5,
    "filmLength": 128.95,
    "printingLength": 138.24
  },
  {
    "teeth": 52,
    "pitchCircleDiameter": 44.87,
    "plateThickness": 1.7,
    "cylinderDiameter": 41.37,
    "filmLength": 131.66,
    "printingLength": 140.95
  },
  {
    "teeth": 53,
    "pitchCircleDiameter": 45.73,
    "plateThickness": 1.7,
    "cylinderDiameter": 42.23,
    "filmLength": 134.37,
    "printingLength": 143.66
  },
  {
    "teeth": 54,
    "pitchCircleDiameter": 46.59,
    "plateThickness": 1.7,
    "cylinderDiameter": 43.09,
    "filmLength": 137.08,
    "printingLength": 146.38
  },
  {
    "teeth": 55,
    "pitchCircleDiameter": 47.46,
    "plateThickness": 1.7,
    "cylinderDiameter": 43.96,
    "filmLength": 139.79,
    "printingLength": 149.09
  },
  {
    "teeth": 56,
    "pitchCircleDiameter": 48.32,
    "plateThickness": 1.7,
    "cylinderDiameter": 44.82,
    "filmLength": 142.5,
    "printingLength": 151.8
  },
  {
    "teeth": 57,
    "pitchCircleDiameter": 49.18,
    "plateThickness": 1.7,
    "cylinderDiameter": 45.68,
    "filmLength": 145.21,
    "printingLength": 154.51
  },
  {
    "teeth": 58,
    "pitchCircleDiameter": 50.04,
    "plateThickness": 1.7,
    "cylinderDiameter": 46.54,
    "filmLength": 147.92,
    "printingLength": 157.22
  },
  {
    "teeth": 59,
    "pitchCircleDiameter": 50.91,
    "plateThickness": 1.7,
    "cylinderDiameter": 47.41,
    "filmLength": 150.63,
    "printingLength": 159.93
  },
  {
    "teeth": 60,
    "pitchCircleDiameter": 51.77,
    "plateThickness": 1.7,
    "cylinderDiameter": 48.27,
    "filmLength": 153.34,
    "printingLength": 162.64
  },
  {
    "teeth": 61,
    "pitchCircleDiameter": 52.63,
    "plateThickness": 1.7,
    "cylinderDiameter": 49.13,
    "filmLength": 156.05,
    "printingLength": 165.35
  },
  {
    "teeth": 62,
    "pitchCircleDiameter": 53.5,
    "plateThickness": 1.7,
    "cylinderDiameter": 50.0,
    "filmLength": 158.76,
    "printingLength": 168.06
  },
  {
    "teeth": 63,
    "pitchCircleDiameter": 54.36,
    "plateThickness": 1.7,
    "cylinderDiameter": 50.86,
    "filmLength": 161.48,
    "printingLength": 170.77
  },
  {
    "teeth": 64,
    "pitchCircleDiameter": 55.22,
    "plateThickness": 1.7,
    "cylinderDiameter": 51.72,
    "filmLength": 164.19,
    "printingLength": 173.48
  },
  {
    "teeth": 65,
    "pitchCircleDiameter": 56.08,
    "plateThickness": 1.7,
    "cylinderDiameter": 52.58,
    "filmLength": 166.9,
    "printingLength": 176.19
  },
  {
    "teeth": 66,
    "pitchCircleDiameter": 56.95,
    "plateThickness": 1.7,
    "cylinderDiameter": 53.45,
    "filmLength": 169.61,
    "printingLength": 178.9
  },
  {
    "teeth": 67,
    "pitchCircleDiameter": 57.81,
    "plateThickness": 1.7,
    "cylinderDiameter": 54.31,
    "filmLength": 172.32,
    "printingLength": 181.61
  },
  {
    "teeth": 68,
    "pitchCircleDiameter": 58.67,
    "plateThickness": 1.7,
    "cylinderDiameter": 55.17,
    "filmLength": 175.03,
    "printingLength": 184.32
  },
  {
    "teeth": 69,
    "pitchCircleDiameter": 59.54,
    "plateThickness": 1.7,
    "cylinderDiameter": 56.04,
    "filmLength": 177.74,
    "printingLength": 187.04
  },
  {
    "teeth": 70,
    "pitchCircleDiameter": 60.4,
    "plateThickness": 1.7,
    "cylinderDiameter": 56.9,
    "filmLength": 180.45,
    "printingLength": 189.75
  },
  {
    "teeth": 71,
    "pitchCircleDiameter": 61.26,
    "plateThickness": 1.7,
    "cylinderDiameter": 57.76,
    "filmLength": 183.16,
    "printingLength": 192.46
  },
  {
    "teeth": 72,
    "pitchCircleDiameter": 62.12,
    "plateThickness": 1.7,
    "cylinderDiameter": 58.62,
    "filmLength": 185.87,
    "printingLength": 195.17
  },
  {
    "teeth": 73,
    "pitchCircleDiameter": 62.99,
    "plateThickness": 1.7,
    "cylinderDiameter": 59.49,
    "filmLength": 188.58,
    "printingLength": 197.88
  },
  {
    "teeth": 74,
    "pitchCircleDiameter": 63.85,
    "plateThickness": 1.7,
    "cylinderDiameter": 60.35,
    "filmLength": 191.29,
    "printingLength": 200.59
  },
  {
    "teeth": 75,
    "pitchCircleDiameter": 64.71,
    "plateThickness": 1.7,
    "cylinderDiameter": 61.21,
    "filmLength": 194.0,
    "printingLength": 203.3
  },
  {
    "teeth": 76,
    "pitchCircleDiameter": 65.57,
    "plateThickness": 1.7,
    "cylinderDiameter": 62.07,
    "filmLength": 196.71,
    "printingLength": 206.01
  },
  {
    "teeth": 77,
    "pitchCircleDiameter": 66.44,
    "plateThickness": 1.7,
    "cylinderDiameter": 62.94,
    "filmLength": 199.42,
    "printingLength": 208.72
  },
  {
    "teeth": 78,
    "pitchCircleDiameter": 67.3,
    "plateThickness": 1.7,
    "cylinderDiameter": 63.8,
    "filmLength": 202.14,
    "printingLength": 211.43
  },
  {
    "teeth": 79,
    "pitchCircleDiameter": 68.16,
    "plateThickness": 1.7,
    "cylinderDiameter": 64.66,
    "filmLength": 204.85,
    "printingLength": 214.14
  },
  {
    "teeth": 80,
    "pitchCircleDiameter": 69.03,
    "plateThickness": 1.7,
    "cylinderDiameter": 65.53,
    "filmLength": 207.56,
    "printingLength": 216.85
  },
  {
    "teeth": 81,
    "pitchCircleDiameter": 69.89,
    "plateThickness": 1.7,
    "cylinderDiameter": 66.39,
    "filmLength": 210.27,
    "printingLength": 219.56
  },
  {
    "teeth": 82,
    "pitchCircleDiameter": 70.75,
    "plateThickness": 1.7,
    "cylinderDiameter": 67.25,
    "filmLength": 212.98,
    "printingLength": 222.27
  },
  {
    "teeth": 83,
    "pitchCircleDiameter": 71.61,
    "plateThickness": 1.7,
    "cylinderDiameter": 68.11,
    "filmLength": 215.69,
    "printingLength": 224.98
  },
  {
    "teeth": 84,
    "pitchCircleDiameter": 72.48,
    "plateThickness": 1.7,
    "cylinderDiameter": 68.98,
    "filmLength": 218.4,
    "printingLength": 227.69
  },
  {
    "teeth": 85,
    "pitchCircleDiameter": 73.34,
    "plateThickness": 1.7,
    "cylinderDiameter": 69.84,
    "filmLength": 221.11,
    "printingLength": 230.41
  },
  {
    "teeth": 86,
    "pitchCircleDiameter": 74.2,
    "plateThickness": 1.7,
    "cylinderDiameter": 70.7,
    "filmLength": 223.82,
    "printingLength": 233.12
  },
  {
    "teeth": 87,
    "pitchCircleDiameter": 75.07,
    "plateThickness": 1.7,
    "cylinderDiameter": 71.57,
    "filmLength": 226.53,
    "printingLength": 235.83
  },
  {
    "teeth": 88,
    "pitchCircleDiameter": 75.93,
    "plateThickness": 1.7,
    "cylinderDiameter": 72.43,
    "filmLength": 229.24,
    "printingLength": 238.54
  },
  {
    "teeth": 89,
    "pitchCircleDiameter": 76.79,
    "plateThickness": 1.7,
    "cylinderDiameter": 73.29,
    "filmLength": 231.95,
    "printingLength": 241.25
  },
  {
    "teeth": 90,
    "pitchCircleDiameter": 77.65,
    "plateThickness": 1.7,
    "cylinderDiameter": 74.15,
    "filmLength": 234.66,
    "printingLength": 243.96
  },
  {
    "teeth": 91,
    "pitchCircleDiameter": 78.52,
    "plateThickness": 1.7,
    "cylinderDiameter": 75.02,
    "filmLength": 237.37,
    "printingLength": 246.67
  },
  {
    "teeth": 92,
    "pitchCircleDiameter": 79.38,
    "plateThickness": 1.7,
    "cylinderDiameter": 75.88,
    "filmLength": 240.08,
    "printingLength": 249.38
  },
  {
    "teeth": 93,
    "pitchCircleDiameter": 80.24,
    "plateThickness": 1.7,
    "cylinderDiameter": 76.74,
    "filmLength": 242.8,
    "printingLength": 252.09
  },
  {
    "teeth": 94,
    "pitchCircleDiameter": 81.11,
    "plateThickness": 1.7,
    "cylinderDiameter": 77.61,
    "filmLength": 245.51,
    "printingLength": 254.8
  },
  {
    "teeth": 95,
    "pitchCircleDiameter": 81.97,
    "plateThickness": 1.7,
    "cylinderDiameter": 78.47,
    "filmLength": 248.22,
    "printingLength": 257.51
  },
  {
    "teeth": 96,
    "pitchCircleDiameter": 82.83,
    "plateThickness": 1.7,
    "cylinderDiameter": 79.33,
    "filmLength": 250.93,
    "printingLength": 260.22
  },
  {
    "teeth": 97,
    "pitchCircleDiameter": 83.69,
    "plateThickness": 1.7,
    "cylinderDiameter": 80.19,
    "filmLength": 253.64,
    "printingLength": 262.93
  },
  {
    "teeth": 98,
    "pitchCircleDiameter": 84.56,
    "plateThickness": 1.7,
    "cylinderDiameter": 81.06,
    "filmLength": 256.35,
    "printingLength": 265.64
  },
  {
    "teeth": 99,
    "pitchCircleDiameter": 85.42,
    "plateThickness": 1.7,
    "cylinderDiameter": 81.92,
    "filmLength": 259.06,
    "printingLength": 268.35
  },
  {
    "teeth": 100,
    "pitchCircleDiameter": 86.28,
    "plateThickness": 1.7,
    "cylinderDiameter": 82.78,
    "filmLength": 261.77,
    "printingLength": 271.07
  },
  {
    "teeth": 101,
    "pitchCircleDiameter": 87.15,
    "plateThickness": 1.7,
    "cylinderDiameter": 83.65,
    "filmLength": 264.48,
    "printingLength": 273.78
  },
  {
    "teeth": 102,
    "pitchCircleDiameter": 88.01,
    "plateThickness": 1.7,
    "cylinderDiameter": 84.51,
    "filmLength": 267.19,
    "printingLength": 276.49
  },
  {
    "teeth": 103,
    "pitchCircleDiameter": 88.87,
    "plateThickness": 1.7,
    "cylinderDiameter": 85.37,
    "filmLength": 269.9,
    "printingLength": 279.2
  },
  {
    "teeth": 104,
    "pitchCircleDiameter": 89.73,
    "plateThickness": 1.7,
    "cylinderDiameter": 86.23,
    "filmLength": 272.61,
    "printingLength": 281.91
  },
  {
    "teeth": 105,
    "pitchCircleDiameter": 90.6,
    "plateThickness": 1.7,
    "cylinderDiameter": 87.1,
    "filmLength": 275.32,
    "printingLength": 284.62
  },
  {
    "teeth": 106,
    "pitchCircleDiameter": 91.46,
    "plateThickness": 1.7,
    "cylinderDiameter": 87.96,
    "filmLength": 278.03,
    "printingLength": 287.33
  },
  {
    "teeth": 107,
    "pitchCircleDiameter": 92.32,
    "plateThickness": 1.7,
    "cylinderDiameter": 88.82,
    "filmLength": 280.74,
    "printingLength": 290.04
  },
  {
    "teeth": 108,
    "pitchCircleDiameter": 93.19,
    "plateThickness": 1.7,
    "cylinderDiameter": 89.69,
    "filmLength": 283.45,
    "printingLength": 292.75
  },
  {
    "teeth": 109,
    "pitchCircleDiameter": 94.05,
    "plateThickness": 1.7,
    "cylinderDiameter": 90.55,
    "filmLength": 286.17,
    "printingLength": 295.46
  },
  {
    "teeth": 110,
    "pitchCircleDiameter": 94.91,
    "plateThickness": 1.7,
    "cylinderDiameter": 91.41,
    "filmLength": 288.88,
    "printingLength": 298.17
  },
  {
    "teeth": 111,
    "pitchCircleDiameter": 95.77,
    "plateThickness": 1.7,
    "cylinderDiameter": 92.27,
    "filmLength": 291.59,
    "printingLength": 300.88
  },
  {
    "teeth": 112,
    "pitchCircleDiameter": 96.64,
    "plateThickness": 1.7,
    "cylinderDiameter": 93.14,
    "filmLength": 294.3,
    "printingLength": 303.59
  },
  {
    "teeth": 113,
    "pitchCircleDiameter": 97.5,
    "plateThickness": 1.7,
    "cylinderDiameter": 94.0,
    "filmLength": 297.01,
    "printingLength": 306.3
  },
  {
    "teeth": 114,
    "pitchCircleDiameter": 98.36,
    "plateThickness": 1.7,
    "cylinderDiameter": 94.86,
    "filmLength": 299.72,
    "printingLength": 309.01
  },
  {
    "teeth": 115,
    "pitchCircleDiameter": 99.23,
    "plateThickness": 1.7,
    "cylinderDiameter": 95.73,
    "filmLength": 302.43,
    "printingLength": 311.73
  },
  {
    "teeth": 116,
    "pitchCircleDiameter": 100.09,
    "plateThickness": 1.7,
    "cylinderDiameter": 96.59,
    "filmLength": 305.14,
    "printingLength": 314.44
  },
  {
    "teeth": 117,
    "pitchCircleDiameter": 100.95,
    "plateThickness": 1.7,
    "cylinderDiameter": 97.45,
    "filmLength": 307.85,
    "printingLength": 317.15
  },
  {
    "teeth": 118,
    "pitchCircleDiameter": 101.81,
    "plateThickness": 1.7,
    "cylinderDiameter": 98.31,
    "filmLength": 310.56,
    "printingLength": 319.86
  },
  {
    "teeth": 119,
    "pitchCircleDiameter": 102.68,
    "plateThickness": 1.7,
    "cylinderDiameter": 99.18,
    "filmLength": 313.27,
    "printingLength": 322.57
  },
  {
    "teeth": 120,
    "pitchCircleDiameter": 103.54,
    "plateThickness": 1.7,
    "cylinderDiameter": 100.04,
    "filmLength": 315.98,
    "printingLength": 325.28
  },
  {
    "teeth": 121,
    "pitchCircleDiameter": 104.4,
    "plateThickness": 1.7,
    "cylinderDiameter": 100.9,
    "filmLength": 318.69,
    "printingLength": 327.99
  },
  {
    "teeth": 122,
    "pitchCircleDiameter": 105.26,
    "plateThickness": 1.7,
    "cylinderDiameter": 101.76,
    "filmLength": 321.4,
    "printingLength": 330.7
  },
  {
    "teeth": 123,
    "pitchCircleDiameter": 106.13,
    "plateThickness": 1.7,
    "cylinderDiameter": 102.63,
    "filmLength": 324.11,
    "printingLength": 333.41
  },
  {
    "teeth": 124,
    "pitchCircleDiameter": 106.99,
    "plateThickness": 1.7,
    "cylinderDiameter": 103.49,
    "filmLength": 326.83,
    "printingLength": 336.12
  },
  {
    "teeth": 125,
    "pitchCircleDiameter": 107.85,
    "plateThickness": 1.7,
    "cylinderDiameter": 104.35,
    "filmLength": 329.54,
    "printingLength": 338.83
  },
  {
    "teeth": 126,
    "pitchCircleDiameter": 108.72,
    "plateThickness": 1.7,
    "cylinderDiameter": 150.22,
    "filmLength": 332.25,
    "printingLength": 341.54,
    "needsVerification": true,
    "verificationNote": "Cylinder diameter 150.22 mm deviates from trend (expected ~105.22 mm). Flagged for human verification."
  },
  {
    "teeth": 127,
    "pitchCircleDiameter": 109.58,
    "plateThickness": 1.7,
    "cylinderDiameter": 106.08,
    "filmLength": 334.96,
    "printingLength": 344.25
  },
  {
    "teeth": 128,
    "pitchCircleDiameter": 110.44,
    "plateThickness": 1.7,
    "cylinderDiameter": 106.94,
    "filmLength": 337.67,
    "printingLength": 346.96
  },
  {
    "teeth": 129,
    "pitchCircleDiameter": 111.3,
    "plateThickness": 1.7,
    "cylinderDiameter": 107.8,
    "filmLength": 340.38,
    "printingLength": 349.67
  },
  {
    "teeth": 130,
    "pitchCircleDiameter": 112.17,
    "plateThickness": 1.7,
    "cylinderDiameter": 108.67,
    "filmLength": 343.09,
    "printingLength": 352.38
  },
  {
    "teeth": 131,
    "pitchCircleDiameter": 113.03,
    "plateThickness": 1.7,
    "cylinderDiameter": 109.53,
    "filmLength": 345.8,
    "printingLength": 355.1
  },
  {
    "teeth": 132,
    "pitchCircleDiameter": 113.89,
    "plateThickness": 1.7,
    "cylinderDiameter": 110.39,
    "filmLength": 348.51,
    "printingLength": 357.81
  },
  {
    "teeth": 133,
    "pitchCircleDiameter": 114.76,
    "plateThickness": 1.7,
    "cylinderDiameter": 111.26,
    "filmLength": 351.22,
    "printingLength": 360.52
  },
  {
    "teeth": 134,
    "pitchCircleDiameter": 115.62,
    "plateThickness": 1.7,
    "cylinderDiameter": 112.12,
    "filmLength": 353.93,
    "printingLength": 363.23
  },
  {
    "teeth": 135,
    "pitchCircleDiameter": 116.48,
    "plateThickness": 1.7,
    "cylinderDiameter": 112.98,
    "filmLength": 356.64,
    "printingLength": 365.94
  },
  {
    "teeth": 136,
    "pitchCircleDiameter": 117.34,
    "plateThickness": 1.7,
    "cylinderDiameter": 113.84,
    "filmLength": 359.35,
    "printingLength": 368.65
  },
  {
    "teeth": 137,
    "pitchCircleDiameter": 118.21,
    "plateThickness": 1.7,
    "cylinderDiameter": 114.71,
    "filmLength": 362.06,
    "printingLength": 371.36
  },
  {
    "teeth": 138,
    "pitchCircleDiameter": 119.07,
    "plateThickness": 1.7,
    "cylinderDiameter": 115.57,
    "filmLength": 364.77,
    "printingLength": 374.07
  },
  {
    "teeth": 139,
    "pitchCircleDiameter": 119.93,
    "plateThickness": 1.7,
    "cylinderDiameter": 116.43,
    "filmLength": 367.49,
    "printingLength": 376.78
  },
  {
    "teeth": 140,
    "pitchCircleDiameter": 120.8,
    "plateThickness": 1.7,
    "cylinderDiameter": 117.3,
    "filmLength": 370.2,
    "printingLength": 379.49
  },
  {
    "teeth": 141,
    "pitchCircleDiameter": 121.66,
    "plateThickness": 1.7,
    "cylinderDiameter": 118.16,
    "filmLength": 372.91,
    "printingLength": 382.2
  },
  {
    "teeth": 142,
    "pitchCircleDiameter": 122.52,
    "plateThickness": 1.7,
    "cylinderDiameter": 119.02,
    "filmLength": 375.62,
    "printingLength": 384.91
  },
  {
    "teeth": 143,
    "pitchCircleDiameter": 123.38,
    "plateThickness": 1.7,
    "cylinderDiameter": 119.88,
    "filmLength": 378.33,
    "printingLength": 387.62
  },
  {
    "teeth": 144,
    "pitchCircleDiameter": 124.25,
    "plateThickness": 1.7,
    "cylinderDiameter": 120.75,
    "filmLength": 381.04,
    "printingLength": 390.33
  },
  {
    "teeth": 145,
    "pitchCircleDiameter": 125.11,
    "plateThickness": 1.7,
    "cylinderDiameter": 121.61,
    "filmLength": 383.75,
    "printingLength": 393.04
  },
  {
    "teeth": 146,
    "pitchCircleDiameter": 125.97,
    "plateThickness": 1.7,
    "cylinderDiameter": 122.47,
    "filmLength": 386.46,
    "printingLength": 395.76
  },
  {
    "teeth": 147,
    "pitchCircleDiameter": 126.84,
    "plateThickness": 1.7,
    "cylinderDiameter": 123.34,
    "filmLength": 389.17,
    "printingLength": 398.47
  },
  {
    "teeth": 148,
    "pitchCircleDiameter": 127.7,
    "plateThickness": 1.7,
    "cylinderDiameter": 124.2,
    "filmLength": 391.83,
    "printingLength": 401.18
  },
  {
    "teeth": 149,
    "pitchCircleDiameter": 128.56,
    "plateThickness": 1.7,
    "cylinderDiameter": 125.06,
    "filmLength": 394.59,
    "printingLength": 403.89
  }
];

export const FLEXO_MACHINES: FlexoMachine[] = [
  {
    id: "JR-1521",
    name: "JR-1521 Narrow Web Flexo Press",
    model: "JR-1521",
    gearSystem: "JR-1521 Pitch 2.7107mm",
    minWebWidth: 10,
    maxWebWidth: 150,
    maxPrintWidth: 140,
    standardPlateThickness: 1.7,
    availableCylinders: JR_1521_CYLINDERS,
  },
  {
    id: "GALLUS-EM280",
    name: "Gallus EM 280 Flexo Press",
    model: "EM 280",
    gearSystem: "1/8 CP (3.175mm)",
    minWebWidth: 50,
    maxWebWidth: 282,
    maxPrintWidth: 280,
    standardPlateThickness: 1.7,
    availableCylinders: JR_1521_CYLINDERS,
  },
  {
    id: "MARK-ANDY-2200",
    name: "Mark Andy 2200 Flexo Press",
    model: "2200-10",
    gearSystem: "1/8 CP (3.175mm)",
    minWebWidth: 50,
    maxWebWidth: 254,
    maxPrintWidth: 250,
    standardPlateThickness: 1.7,
    availableCylinders: JR_1521_CYLINDERS,
  },
];

export const FLEXO_MATERIALS: FlexoMaterial[] = [
  {
    id: "satin-white",
    name: "Satin Ribbon (White)",
    category: "Satin",
    defaultWebWidth: 30,
    standardWidths: [15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 100],
    color: "#f8fafc",
    description: "Silky woven edge polyester satin for luxury textile labels",
  },
  {
    id: "satin-black",
    name: "Satin Ribbon (Black)",
    category: "Satin",
    defaultWebWidth: 30,
    standardWidths: [15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 100],
    color: "#18181b",
    description: "Dyed black woven edge polyester satin",
  },
  {
    id: "nylon-taffeta",
    name: "Nylon Taffeta Roll",
    category: "Nylon",
    defaultWebWidth: 35,
    standardWidths: [20, 25, 30, 35, 40, 50, 60, 70, 80, 100],
    color: "#f4f4f5",
    description: "Slit-edge coated nylon taffeta for care and wash instructions",
  },
  {
    id: "self-adhesive-pp",
    name: "Self-Adhesive PP Film (White)",
    category: "Self-Adhesive",
    defaultWebWidth: 100,
    standardWidths: [50, 60, 80, 100, 120, 140, 150],
    color: "#ffffff",
    description: "Gloss white polypropylene roll label with permanent acrylic adhesive",
  },
  {
    id: "semi-gloss-paper",
    name: "Semi-Gloss Label Paper",
    category: "Paper",
    defaultWebWidth: 100,
    standardWidths: [50, 60, 80, 100, 120, 140, 150],
    color: "#fafaf9",
    description: "Machine-coated semi-gloss paper with glassine liner",
  },
  {
    id: "thermal-top",
    name: "Direct Thermal Top Paper",
    category: "Thermal",
    defaultWebWidth: 58,
    standardWidths: [40, 58, 80, 100],
    color: "#f5f5f4",
    description: "Top-coated protective thermal substrate for barcoding & courier labels",
  },
  {
    id: "cotton-tape",
    name: "Organic Cotton Tape (Herringbone)",
    category: "Textile",
    defaultWebWidth: 25,
    standardWidths: [15, 20, 25, 30, 35, 40, 50],
    color: "#fef3c7",
    description: "100% natural unbleached cotton herringbone webbing",
  },
];

export const DEFAULT_DIES_TOOLING: import("./types").FlexoDieTooling[] = [
  {
    id: "DIE-RECT-50x90-R3",
    code: "DIE-RECT-50x90-R3",
    name: "Hangtag Die 50×90 mm (R3)",
    dieType: "rotary_magnetic",
    shape: "rounded_rect",
    widthMm: 50,
    heightMm: 90,
    cornerRadiusMm: 3,
    acrossCount: 2,
    aroundCount: 1,
    gapXMm: 3,
    gapYMm: 3,
    repeatLengthMm: 93,
    cylinderTeeth: 70,
    location: "SHELF-DIE-A1",
    status: "available",
    totalImpressions: 12500,
    notes: "Standart kiyim yorliqlari uchun egiluvchan magnit pichoq",
  },
  {
    id: "DIE-CIRC-40",
    code: "DIE-CIRC-40",
    name: "Round Sticker Die Ø 40 mm",
    dieType: "rotary_magnetic",
    shape: "circle",
    widthMm: 40,
    heightMm: 40,
    cornerRadiusMm: 20,
    acrossCount: 3,
    aroundCount: 2,
    gapXMm: 3,
    gapYMm: 3,
    repeatLengthMm: 86,
    cylinderTeeth: 64,
    location: "SHELF-DIE-B2",
    status: "available",
    totalImpressions: 45000,
    notes: "Doira stikerlar va qadoq plombasi uchun",
  },
  {
    id: "DIE-LABEL-30x70",
    code: "DIE-LABEL-30x70",
    name: "Textile Care Label Die 30×70 mm",
    dieType: "solid_rotary",
    shape: "rectangle",
    widthMm: 30,
    heightMm: 70,
    cornerRadiusMm: 0,
    acrossCount: 1,
    aroundCount: 1,
    gapXMm: 0,
    gapYMm: 2,
    repeatLengthMm: 72,
    cylinderTeeth: 53,
    location: "SHELF-DIE-C1",
    status: "available",
    totalImpressions: 89000,
    notes: "Satin va neylon tasmalar uchun issiq/sovuq qirquvchi pichoq",
  },
  {
    id: "DIE-STICKER-50x50-R2",
    code: "DIE-STICKER-50x50-R2",
    name: "Square Sticker Die 50×50 mm (R2)",
    dieType: "rotary_magnetic",
    shape: "rounded_rect",
    widthMm: 50,
    heightMm: 50,
    cornerRadiusMm: 2,
    acrossCount: 2,
    aroundCount: 2,
    gapXMm: 3,
    gapYMm: 3,
    repeatLengthMm: 106,
    cylinderTeeth: 78,
    location: "SHELF-DIE-A3",
    status: "available",
    totalImpressions: 34000,
    notes: "Kvadrat samokleyka stikerlar uchun",
  },
];

/**
 * Server API orqali stanoklar ro'yxatini yuklash (PostgreSQL + Redis orqali)
 * Xatolik bo'lsa lokal FLEXO_MACHINES ga avtomatik o'tadi
 */
export async function fetchFlexoMachinesAsync(companyCode = "PRINTGOO"): Promise<FlexoMachine[]> {
  try {
    const res = await fetch(`/api/v1/master/printing/machines?company=${companyCode}`);
    if (!res.ok) throw new Error("Failed to load machines from API");
    const json = await res.json();
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      return json.data;
    }
  } catch (e) {
    console.warn("[FlexoMasterData] Fallback to local machines:", e);
  }
  return FLEXO_MACHINES;
}

/**
 * Server API orqali pichoq va shtamplar ro'yxatini yuklash
 */
export async function fetchDiesToolingAsync(companyCode = "PRINTGOO"): Promise<import("./types").FlexoDieTooling[]> {
  try {
    const res = await fetch(`/api/v1/master/printing/dies?company=${companyCode}`);
    if (!res.ok) throw new Error("Failed to load dies from API");
    const json = await res.json();
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      return json.data.map((d: any) => ({
        ...d,
        widthMm: Number(d.widthMm),
        heightMm: Number(d.heightMm),
        cornerRadiusMm: Number(d.cornerRadiusMm),
        gapXMm: Number(d.gapXMm),
        gapYMm: Number(d.gapYMm),
        repeatLengthMm: d.repeatLengthMm ? Number(d.repeatLengthMm) : undefined,
      }));
    }
  } catch (e) {
    console.warn("[FlexoMasterData] Fallback to local dies:", e);
  }
  return DEFAULT_DIES_TOOLING;
}
