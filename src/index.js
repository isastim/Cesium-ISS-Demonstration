import {
  Viewer,
  Terrain,
  Cartesian3,
  Color,
  JulianDate,
  SampledPositionProperty,
  LagrangePolynomialApproximation,
  Cartesian2,
} from "cesium";
import "cesium/Widgets/widgets.css";
import "../src/css/main.css";
import * as satellite from "satellite.js";

class TimePositionPairs{
  constructor(){
    this.timePositionPairs = {}
  }

  /**
   * 
   * @param {JulianDate} time 
   * @param {Cartesian3} position 
   */
  addSample(time, position){
    this.timePositionPairs[time] = position
  }

  /**
   * 
   * @returns {[Cartesian3]}
   */
  getPositions(){
    return Object.values(this.timePositionPairs)
  }

  /**
   * 
   * @returns {SampledPositionProperty}
   */
  toSampledPositionProperty(){
    var sampledPositionProperty = new SampledPositionProperty()
    sampledPositionProperty.addSamples(Object.keys(this.timePositionPairs), Object.values(this.timePositionPairs))
    sampledPositionProperty.setInterpolationOptions({
      interpolationAlgorithm: LagrangePolynomialApproximation,
      interpolationDegree: 8
    })
    return sampledPositionProperty
  }
}

JulianDate.prototype.addHours = function (hours){
  return JulianDate.addHours(this.clone(), hours, new JulianDate())
}

// Initialize the Cesium Viewer in the HTML element with the `cesiumContainer` ID.
const viewer = new Viewer("cesiumContainer", {
  terrain: Terrain.fromWorldTerrain(),
  
})
viewer.clock.shouldAnimate = true

// Sample TLE
var tleLine1 = '1 25544U 98067A   19156.50900463  .00003075  00000-0  59442-4 0  9992',
    tleLine2 = '2 25544  51.6433  59.2583 0008217  16.4489 347.6017 15.51174618173442';    

const satrec = satellite.twoline2satrec(tleLine1, tleLine2)
const positionsOverTime = propagateInterval(satrec, JulianDate.now(), JulianDate.addDays(JulianDate.now(), 1/15.51174618, new JulianDate()))
const eventPositionOverTime = propagateInterval(satrec, JulianDate.now().addHours(1), JulianDate.now().addHours(2))

const satellitePoint = viewer.entities.add({
  position: positionsOverTime.toSampledPositionProperty(),
  point: {  pixelSize: 15, color: Color.BLUE, }
});

const someEvent = viewer.entities.add({
  name: "Some Event",
  polylineVolume: {
    positions: eventPositionOverTime.getPositions(),
    shape: computeCircle(60000.0),
    material: Color.LAWNGREEN,
  },
});

const orbitPath = viewer.entities.add({
  name: "Red line on terrain",
  polyline: {
    positions: positionsOverTime.getPositions(),
    width: 1,
    material: Color.RED,
    clampToGround: false,
  },
})

viewer.trackedEntity = satellitePoint

function computeCircle(radius) {
  const positions = [];
  for (let i = 0; i < 360; i++) {
    const radians = i * Math.PI/180
    positions.push(
      new Cartesian2(
        radius * Math.cos(radians),
        radius * Math.sin(radians)
      )
    );
  }
  return positions;
}

/**
 * @param {satellite.SatRec} satrec 
 * @param {JulianDate} start 
 * @param {JulianDate} stop 
 * @returns {TimePositionPairs}
 */
function propagateInterval(satrec, start, stop){
  let time = start.clone(); 
  const positionsOverTime = new TimePositionPairs()
  for (let offset = 0; JulianDate.lessThan(time, stop); offset+= 100) {
    time = JulianDate.addSeconds(start, offset, new JulianDate())
    const jsTime = JulianDate.toDate(time)
    const positionAndVelocity = satellite.propagate(satrec, jsTime)
    const gmst = satellite.gstime(jsTime)
    const position = satellite.eciToGeodetic(positionAndVelocity.position, gmst)
    positionsOverTime.addSample(time, Cartesian3.fromRadians(position.longitude, position.latitude, position.height * 1000))
  }
  return positionsOverTime
}

