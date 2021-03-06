import { 
  select,
  line,
  curveBasis,
  scaleOrdinal
  } from 'd3';

const svg = select('#diagram');
const width = +svg.attr('width');
const height = +svg.attr('height');
let timeDisplay

//Map energy values to stroke widths
const radialSym = 8
const xScaleFactor = 1.5

const iconWidth = 100

const nodeRadius = 50
const nodeStroke = 3
const radialCentreX = width/2
const radialCentreY = height/2
const radialRadius =  height/2-100
const pathOffsetY = nodeRadius+ 50
const pathStroke = 6

const textUnitOffsetY = 38
const textValueOffsetY = 22
const textNameOffsetX = iconWidth/2 +15
const textNameOffsetY = -10
const textGroupOffsetY = 12

const breakMinPower = 0.1
const breakMinStroke = pathStroke
const breakMaxPower = 5
const breakMaxStroke = 8*pathStroke

const pathYOffsetMax = 60
const pathYOffsetMin = 30

/**
* Get the X position of a point on a circle, spaced by 45 degrees
* @param {string} i - the position index, starting at 12'o clock, going counterclockwise
* @returns {number} - x position to the nearest pixel
*/
const getX = (i) =>{
  return Math.round(Math.sin(2*Math.PI/8*(i+4))*radialRadius*xScaleFactor+radialCentreX);
}

/**
* Get the Y position of a point on a circle, spaced by 45 degrees
* @todo Once design is stable, bake values into an array
* @param {string} i - the position index, starting at 12'o clock, going counterclockwise
* @returns {number} - y position to the nearest pixel
*/
const getY = (i) =>{
  return Math.round(Math.cos(2*Math.PI/8*(i+4))*radialRadius+radialCentreY);
}

const offsetText = (textPos, centrePos, offset)=>{
  return textPos>centrePos?offset:-offset
}

/**
 * map a power value to a stroke value.
 * @param {*} value -number representing power value
 * @returns stroke value
 */
const getStrokeWidth = (value)=>{
  //truncate extreme power values
  const valueCapped = Math.max(Math.min(value, breakMaxPower),breakMinPower)
  //map power to stroke
  return valueCapped/(breakMaxPower/breakMaxStroke)
}

/**
* Get the array of tuples used to generate a curved path string for a single-direction node to the centre
* @param {number} x1 - path start x position
* @param {number} y1 - path start y position
* @param {number} x2Offset - x offset from the centre of the circle
* @returns {Array} - Array of [x,y] arrays
*/
const generateNodePath = (x1,y1,x2Offset) =>{
  const x2 = radialCentreX + x2Offset
  const y2 = radialCentreY
  return [[x1,y1],[x2,y1],[x2,y2]]
}

/**
* Get the array of tuples used to generate a curved path string for a multi-direction node to the centre
* @param {number} x1 - path start x position
* @param {number} y1 - path start y position
* @param {number} x2Offset - x offset from the centre of the circle
* @param {boolean} isPos - Wether the path is mirrored across x axis
* @returns {Array} - Array of 5 [x,y] arrays, forming an "arch" shape
*/
const generateComplexPath = (x1,y1,x2Offset,isPos) =>{
  const x2 = radialCentreX + x2Offset
  const y2 = radialCentreY
  let yp1 = y1
  let yp2 = y1
  if(isPos){
    yp1-=pathYOffsetMax
    yp2-=pathYOffsetMin
  }else{
    yp1+=pathYOffsetMax
    yp2+=pathYOffsetMin
  }
  return [[x1,y1],[x1,yp2],[x1+(x2-x1)/2,yp1],[x2,yp2],[x2,y2]]
}

/**
* Get the array of tuples used to generate a curved path string
* @param {number} position - index of node in array
* @param {number} x - path start x position
* @param {number} y - path start y position
* @param {number} strokeOffset - x offset from the centre of the circle
* @param {boolean} isPos - Wether the path is mirrored across x axis
* @returns {Array} - Array of [x,y] arrays
*/
const getPath = (x,y,position,isPos,strokeOffset) => {
  switch(position) {
    //The multidirectional nodes generate more complex and dynamic paths 
    case 2:
    case 6:
      return generateComplexPath(x,y,strokeOffset,isPos)
    default:
      return generateNodePath(x,y,strokeOffset)
  }
}

/**
 * Bundle various UI constants of the network nodes as an object for easy access
 * @returns object containing props
 */
const getAesProps = () => {
  const deviceNames = ["Solar Panels","Wind Turbine", "Battery","DC Charger", "Consumption","Grid","Solar Irradiance","Wind Speed"];
  const isNode = [1,1,1,1,1,1,0,0]
  const iconMap = ["sun","wind","battery","car","house","grid","sun","wind"]
  const iconScale = [1.2,1.4,0.6,0.8,1,1.2]
  const iconX = [-0.5,-0.35,-0.85,-0.9,-0.49,-0.6]
  const iconY = [-0.5,-0.75,-0.25,-0.5,-0.5,-0.75]
  const positions = [0,1,2,5,4,6]
  const edgeOrder = [2,4,3,1,0,5]

  return {deviceNames:deviceNames,isNode:isNode,iconMap:iconMap,iconScale:iconScale,iconX:iconX,iconY:iconY, positions:positions, edgeOrder:edgeOrder}
}


/**
* For the given data generate a companion array of visual properties
* @param {Array} data - expects an array of 6 objects with the power property
* @returns {Array} - Array of objects
*/
const getLayout = (data) => {
  const propsAes = getAesProps()
  var props = new Map();
  var sumPos = 0;
  var sumNeg = 0;

  //get total Power and map to a pixel width
  var powerNet = 0;
  for(const d of data.keys()){
      if(data.get(d)>0 & propsAes.isNode[propsAes.deviceNames.indexOf(d)]){
        powerNet += data.get(d)
      }
  }
  

  const strokeNet = getStrokeWidth(powerNet)
  propsAes.edgeOrder.forEach((d,i)=>{
  if(data.has(propsAes.deviceNames[d])){
    const power = data.get(propsAes.deviceNames[d])
    
    const pos = propsAes.positions[d]
    const x = getX(pos);
    const y = getY(pos);
    const isPos = d==0||d==1||power>0
    const stroke = powerNet==0?0:Math.abs(strokeNet*power/powerNet)
    const strokeMin = Math.max(stroke,breakMinStroke)
    //find where this edge should terminate (as an offset from the center)
    //Running totals of the global positive and negative are required
    var strokeOffset = -strokeNet/2
    if(isPos){
      if((sumPos+strokeMin)>strokeNet){
        strokeOffset = (strokeNet/2-strokeMin/2)
      }else{
        strokeOffset += (sumPos+stroke/2)
      }
      sumPos += stroke
    }else{
      if((sumNeg+strokeMin)>strokeNet){
        strokeOffset = (strokeNet/2-strokeMin/2)
      }else{
        strokeOffset += (sumNeg+stroke/2)
      }
      sumNeg += stroke
      
    }
    //Create prop obj with generated values
    const prop = {
      x:x,
      y:y,
      isPositive:isPos,
      strokeWidth:strokeMin,
      position:pos,
      pathString: getPath(x,y,pos,isPos,strokeOffset),
      icon:{x:propsAes.iconX[d],y:propsAes.iconY[d],name:propsAes.iconMap[d],scale:propsAes.iconScale[d]}
    }
    props.set(propsAes.deviceNames[d],prop);
}})
  return props;
}

/**
 * Create a string to display a time
 * @param {*} date - Date object 
 * @returns - 24 hour time string
 */
const updateTime =  (date = new Date()) => {
  return ('0'+date.getHours()).slice(-2)+":"+('0'+date.getMinutes()).slice(-2);

}


/**
* Render the diagram
* @param {Selection} selection - D3 Slection of canvas object
* @param {Array} data - Array of objects, the data properties
* @param {Array} dataVis - Array of objects, All non-colour/non-text visual properties
*/
const render = (selection, {dataMap,propMap}) =>{
  const dataVis = propMap
  let data = []
  let dataWeather = []
  dataMap.forEach((v,k,m) => {if(propMap.has(k)) data.push({"device":k,"power":v}); else dataWeather.push(v);})

  const edgeLayer = selection.selectAll(".edgeLayer");
  const nodeLayer = selection.selectAll(".nodeLayer");
  const textLayer = selection.selectAll(".textLayer");

  //Map Data to DOM
  const edgeOutlines = edgeLayer.selectAll('.outline-path').data(data)
  const textValue = textLayer.selectAll('.text-value').data(data)
  const textName = textLayer.selectAll('.text-name').data(data)
  const textTime = textLayer.selectAll('.text-time').data([updateTime(new Date(timeDisplay))])
  const nodeIcon = nodeLayer.selectAll('image').data(data)

  const nodesColours = scaleOrdinal().domain(data).range(["#1f77b4","#ff7f0e","#2ca02c","#d62728","#9467bd","#8c564b","#e377c2","#7f7f7f","#bcbd22","#17becf"]);

  const lineGenerator = line();
  lineGenerator.curve(curveBasis);

  //If there is data wihtout selections or the data with selections has updated, then redraw
  //Display Paths
  edgeOutlines.enter().append('path')
    .attr('class', 'outline-path')
    .attr("stroke", (d,i)=> nodesColours(i))
  .merge(edgeOutlines)
    .transition().duration(400)
    .attr("d", (d,i) => lineGenerator(dataVis.get(d.device).pathString))
    .attr("stroke-width", (d,i)=>dataVis.get(d.device).strokeWidth);

  //Display device icon
  nodeIcon.enter().append("svg:image")
    .attr('class', 'node-icon')
    .attr('xlink:href', (d,i) => '/'+dataVis.get(d.device).icon.name+'.svg')
    .attr("x", (d,i) => dataVis.get(d.device).icon.x*iconWidth*dataVis.get(d.device).icon.scale)
    .attr("y", (d,i) => dataVis.get(d.device).icon.y*iconWidth*dataVis.get(d.device).icon.scale)
    .attr('transform', (d,i) => `translate(${dataVis.get(d.device).x}, ${dataVis.get(d.device).y})`)
    .attr("height", (d,i) => iconWidth*dataVis.get(d.device).icon.scale)

  //Display device names
  textName.enter().append('text')
    .attr('class', 'text-name')
    .attr("x", (d,i) => offsetText(dataVis.get(d.device).x, radialCentreX, textNameOffsetX))
    .attr("y", (d,i) => textNameOffsetY)
    .attr('transform', (d,i) => `translate(${dataVis.get(d.device).x}, ${dataVis.get(d.device).y})`)
    .text((d,i) => d.device)
    .attr("text-anchor", (d,i) => (dataVis.get(d.device).x>radialCentreX?"start":"end"))
    .attr("font-size", "14px")
  
  //Display Power values
  textValue.enter().append('text')
    .attr('class', 'text-value')
    .attr("x", (d,i) => offsetText(dataVis.get(d.device).x, radialCentreX, textNameOffsetX))
    .attr("y", (d,i) => textValueOffsetY)
    .attr('transform', (d,i) => `translate(${dataVis.get(d.device).x}, ${dataVis.get(d.device).y})`)
    .attr("text-anchor", (d,i) => (dataVis.get(d.device).x>radialCentreX?"start":"end"))
    .attr("fill", (d,i) => nodesColours(d.group))
  .merge(textValue)
    .text((d,i) => d.power);

  //Display timestamp of currently displayed data
  textTime.enter().append('text')
    .attr('class', 'text-time')
    .attr("x", width - 500)
    .attr("y", 100)
  .merge(textTime)
    .text(d=>d)

  selection.selectAll('.text-value').append('tspan')
      .text("kW")
      
  //Clean up
  nodeIcon.exit().remove()    
  edgeOutlines.exit().remove()
  textValue.exit().remove()
  textName.exit().remove()
}


/**
* Visualise the data as a Energy Map
* @param {Array} data - Array of objects, the data properties
*/
export const renderDiagram = (data, time = new Date()) =>{
  var props = getLayout(data)
  timeDisplay = time
  return  render(svg, {dataMap:data,propMap:props})
}
