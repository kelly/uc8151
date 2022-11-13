const { BufferedGraphicsContext } = require('graphics')
const { REG, FLAGS } = require('./constants')

const defaults = {
  width: 296,
  height: 128,
  dc: -1,
  rst: -1,
  cs: -1,
  busy: -1,
  rotation: 0
}

const LUT_VCOM = new Uint8Array([
  0x00, 0x01, 0x01, 0x02, 0x00, 0x01,
  0x00, 0x02, 0x02, 0x00, 0x00, 0x02,
  0x00, 0x02, 0x02, 0x03, 0x00, 0x02,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00
])

const LUT_WW = new Uint8Array([
  0x54, 0x01, 0x01, 0x02, 0x00, 0x01,
  0x60, 0x02, 0x02, 0x00, 0x00, 0x02,
  0xa8, 0x02, 0x02, 0x03, 0x00, 0x02,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00
])

const LUT_BW = new Uint8Array([
  0x54, 0x01, 0x01, 0x02, 0x00, 0x01,
  0x60, 0x02, 0x02, 0x00, 0x00, 0x02,
  0xa8, 0x02, 0x02, 0x03, 0x00, 0x02,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00
])

const LUT_WB = new Uint8Array([
  0xa8, 0x01, 0x01, 0x02, 0x00, 0x01,
  0x60, 0x02, 0x02, 0x00, 0x00, 0x02,
  0x54, 0x02, 0x02, 0x03, 0x00, 0x02,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00
])

const LUT_BB = new Uint8Array([
  0xa8, 0x01, 0x01, 0x02, 0x00, 0x01,
  0x60, 0x02, 0x02, 0x00, 0x00, 0x02,
  0x54, 0x02, 0x02, 0x03, 0x00, 0x02,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00
])

class UC8151 {
  /**
   * Setup SSD1306 for SPI connection
   * @param {SPI} spi
   * @param {Object} config
   */

  setup(spi, config) {
    this.spi = spi
    this.config = {...defaults, ...config}
    this.context = null
    
    const { dc, rst, cs, busy } = this.config

    if (dc > -1 &&
        rst > -1 &&
        cs > -1 &&
        busy > -1) {
        
        pinMode(dc, OUTPUT)
        pinMode(rst, OUTPUT)
        pinMode(cs, OUTPUT)
        pinMode(busy, INPUT)
    }

    this.reset()
    this.init()

    delay(50)
  }

  isBusy() {
    const { busy } = this.config
    return !digitalRead(busy)
  }

  reset() {
    const { rst } = this.config
    digitalWrite(rst, LOW)
    delay(10)
    digitalWrite(rst, HIGH)

    while(this.isBusy()) {}
  }

  turbo_luts() {
    this.sendCommand(REG.LUT_VCOM, LUT_VCOM)
    this.sendCommand(REG.LUT_WW, LUT_WW)
    this.sendCommand(REG.LUT_BW, LUT_BW)
    this.sendCommand(REG.LUT_WB, LUT_WB)
    this.sendCommand(REG.LUT_BB, LUT_BB)

    while(this.isBusy()) {}
  }

  init() {
    const { PSR, PWR, PON, BTST, PFS, TSE, TCON, CDI, PLL, POF, TRES } = REG
    const { RES_128X296, LUT_OTP, FORMAT_BW, SCAN_DOWN, SHIFT_RIGHT, SCAN_UP, SHIFT_LEFT, BOOSTER_ON, RESET_NONE, 
            VDS_INTERNAL, VDG_INTERNAL, VCOM_VD, VGHL_16V, START_10MS, STRENGTH_3, 
            OFF_6_58US, FRAMES_1, TEMP_INTERNAL, OFFSET_0, HZ_200 } = FLAGS    

    this.sendCommand(PSR, new Uint8Array([(RES_128X296 | LUT_OTP | FORMAT_BW | SCAN_DOWN | SHIFT_RIGHT | BOOSTER_ON | RESET_NONE)]))
    this.turbo_luts()
    this.sendCommand(PWR, new Uint8Array([
      VDS_INTERNAL | VDG_INTERNAL,
      VCOM_VD | VGHL_16V,
      0b101011,
      0b101011,
      0b101011
    ]))

    this.sendCommand(PON) // power on
    while(this.isBusy()) {}

    // // booster soft start configuration
    this.sendCommand(BTST, new Uint8Array([
      START_10MS | STRENGTH_3 | OFF_6_58US,
      START_10MS | STRENGTH_3 | OFF_6_58US,
      START_10MS | STRENGTH_3 | OFF_6_58US
    ]))

    this.sendCommand(PFS, new Uint8Array([
      FRAMES_1
    ]))

    this.sendCommand(TSE, new Uint8Array([
      TEMP_INTERNAL | OFFSET_0
    ]))

    this.sendCommand(TCON, new Uint8Array([0x22])) // tcon setting
    this.sendCommand(CDI, new Uint8Array([0b01_00_1100])) // vcom and data interval
    this.sendCommand(PLL, new Uint8Array([HZ_200]))
    // this.sendCommand(POF)

    while(this.isBusy()) {}
  }

  sendCommand(reg, data) {
    const { dc, cs } = this.config

    digitalWrite(cs, LOW)
    digitalWrite(dc, LOW)
    this.spi.send(new Uint8Array([reg]))

    if (data) {
      digitalWrite(dc, HIGH)
      this.spi.send(data)
    }

    digitalWrite(cs, HIGH)
  }

  sendData(data) {
    const { dc, cs } = this.config

    digitalWrite(cs, LOW)
    digitalWrite(dc, HIGH)
    this.spi.send(data)
    digitalWrite(cs, HIGH)
  }

  getContext() {
    const { width, height, rotation } = this.config

    if (!this.context) {
      this.context = new BufferedGraphicsContext(width, height, {
          rotation: rotation,
          bpp: 1,
          display: (buffer) => this.update(buffer),
        })
      }

    return this.context;
  }

  updatePartial(x, y, w, h, buffer) {
    const { PON, PTIN, PTL, DTM2, DSP, DRF } = REG
    const { height } = this.config

    // y is given in columns ("banks"), which are groups of 8 horiontal pixels
    // x is given in pixels

    const cols = parseInt(h / 8)
    const y1 = parseInt(y / 8)
    //int y2 = y1 + cols;

    const rows = w
    const x1 = x
    //int x2 = x + rows;

    const partialWindow= new Uint8Array([
      y,
      y + h - 1,
      x >> 8,
      x & 0xff,
      (x + w - 1) >> 8,
      (x + w - 1) & 0xff,
      0b00000001  // PT_SCAN
    ])

    this.sendCommand(PON) // turn on
    this.sendCommand(PTIN) // enable partial mode
    this.sendCommand(PTL, new Uint8Array([partialWindow.length, partialWindow]))
    this.sendCommand(DTM2)

    for (let dx = 0; dx < rows; dx++) {
      const sx = dx + x
      const sy = y1
      const idx = sy + (sx * (height / 8))

      this.sendData(new Uint8Array(buffer[idx]))
    }
    
    this.sendCommand(DSP) // data stop
    this.sendCommand(DRF) // start display refresh
  }

  clear() {
    const { DTM1, DTM2 } = REG

    this.sendCommand(DTM1)          
    delay(2);
    for(let i = 0; i < 2888; i++) {
      this.sendData(new Uint8Array([0xFF]))
    }  
    delay(2)
    this.sendCommand(DTM2)           
    delay(2)
    for(let i = 0; i < 2888; i++) {
      this.sendData(new Uint8Array([0xFF]))  
    }  
    delay(2)
  }

  reformatData(buffer) {
    const { width, height } = this.config
    let i = 0;
    let rows = []
    for(let x = 0; x < height / 8; x++) {
      for(let y = 0; y < width; y++) {
        let value = buffer[i]
        if (!rows[y]) {
          rows[y] = []
        }
       rows[y].push(value)
       i++;
      }
    }
    return new Uint8Array(rows.flat())
  }

  update(buffer) {
    const { PTOU, DTM2, DSP, DRF, POF } = REG
    
    while(this.isBusy()) {}

    this.sendCommand(PTOU) // disable partial mode
    this.sendCommand(DTM2, this.reformatData(buffer))
    this.sendCommand(DSP) // data stop
    this.sendCommand(DRF) // start display refresh

    while(this.isBusy()) {}

    this.sendCommand(POF) // start display refresh
  }

  on() {
    const { PON } = REG
    this.sendCommand(PON) // turn off
  }

  off() {
    const { POF } = REG
    this.sendCommand(POF) // turn off
  }
}

exports.UC8151 = UC8151