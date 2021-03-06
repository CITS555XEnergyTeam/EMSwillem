import {
  select,
  scaleLinear,
  scaleOrdinal,
  schemeTableau10,
  scaleTime,
  axisLeft,
  axisBottom,
  line,
  curveBasis
} from 'd3';



const svg = select('#diagram');
const width = +svg.attr('width');
const height = +svg.attr('height');

const margin = { top: 60, right: 200, bottom: 80, left: 105 };
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;
const colorScale = scaleOrdinal(schemeTableau10);

let xAxis, yAxis, xAxisLayer, yAxisLayer, chartLayer, legendLayer, lineGenerator, titleLayer, bgLayer
let dataHidden = []
let dataArgs


let xScale = scaleTime()
let yScale = scaleLinear()

/**
 * Draw graph elements which do no require updating on data refresh
 * @param {*} selection - root SVG element to draw in
 */
export const initializeGraph = (selection) => {

  const yAxisLabel = 'Power (kWh)';
  const xAxisLabel = 'Time';

  selection.append('g').attr("class","xAxisLayer")
  selection.append('g').attr("class","yAxisLayer")
  xAxisLayer = selection.selectAll(".xAxisLayer");
  yAxisLayer = selection.selectAll(".yAxisLayer");

  //Display legend
  selection.append('g').attr("class","legend")
    .attr('transform', `translate(${width-250},${margin.top})`)
      .call(colorLegend, {
        colorScale,
        circleRadius: 13,
        spacing: 30,
        textOffset: 15
      });

  //Background
  selection.append("rect")
    .attr("class", "chartBG")
    .attr("width",innerWidth)
    .attr("height",innerHeight)
  
  //Yaxis
  yAxisLayer.append('text')
    .attr('class', 'axis-label')
    .attr('y', -60)
    .attr('x', -innerHeight / 2)
    .attr('fill', 'black')
    .attr('transform', `rotate(-90)`)
    .attr('text-anchor', 'middle')
    .text(yAxisLabel);
  
  //Xaxis
  xAxisLayer.append('text')
    .attr('class', 'axis-label')
    .attr('y', 80)
    .attr('x', innerWidth / 2)
    .attr('fill', 'black')
    .text(xAxisLabel);
}

/**
 * Prepare data for display by omitting unneeded devices and getting global max and min y values
 * @param {*} data - Data map. See Datastore for details
 * @param {*} inc - Array of keys to include in display data
 * @returns Filtered data and limits
 */
 const prepData = (data, inc = ["Solar Panels","Wind Turbine", "Battery","DC Charger", "Consumption","Grid"]) =>{
  let limits = [0,0]
  let dataMap = data
  for(let key of dataMap.keys()){
    if((inc.includes(key))){
      const l = dataMap.get(key).range
      limits[0] = Math.min(limits[0], l.min)
      limits[1] = Math.max(limits[1], l.max)
    }else{
      dataMap.delete(key)
    }
  }
  return [dataMap,limits]
}


/**
 * Redraw line chart for new data
 * @param {*} data - Data to be displayed as a map. See DataStore object for details
 * @param {*} props - Object containing x and y limits of data/timescale
 * @param {*} selection - Root SVG DOM element
 * @param {*} title - Title string
 */
export const renderGraph = (data, props, selection, title)=> {

  //Remove datapoints from d if they fall outside p.x range
  const getPoints = (d,p) =>{
    const min = p.x[0].getTime()
    const max = p.x[1].getTime()
    let lineData = Array.from(d[1].datapoints.entries())
    return lineData.filter(dp => {return dp[0]>min && dp[0]<max})
  }

  dataArgs = {data,props,selection, title}
  colorScale.domain(data.keys());
  const xValue = t => new Date(t[0])
  const yValue = d => d[1]

    chartLayer = selection.selectAll(".chartLayer");
    chartLayer.attr('transform', `translate(${margin.left},${margin.top})`);
    xAxisLayer = selection.selectAll(".xAxisLayer");
    yAxisLayer = selection.selectAll(".yAxisLayer");
    legendLayer = selection.selectAll(".legend");
    titleLayer = chartLayer.selectAll('.title').datum(title)
    bgLayer = selection.selectAll(".chartBG");

    xScale
      .domain(props.x)
      .range([0, innerWidth])
      //.nice();
    
    yScale
      .domain(props.y)
      .range([innerHeight, 0])
      //.nice();
    
    xAxis = axisBottom(xScale)
    //.tickSize(-innerHeight)
    //.tickPadding(15);

    yAxis = axisLeft(yScale)
    .tickSize(-innerWidth)
    .tickPadding(10);
    
    yAxisLayer
      .transition().duration(750)
      .call(yAxis);

    titleLayer.enter().append('text')
      .attr('class', 'title')
      .attr('y', -10)
      .merge(titleLayer)
        .text(title);

    xAxisLayer
      .attr('transform', `translate(0,${innerHeight})`)
      .transition().duration(750)
        .call(xAxis)
    
    legendLayer
      .call(colorLegend, {
        colorScale,
        circleRadius: 13,
        spacing: 30,
        textOffset: 15
      });

    lineGenerator = line()
      .x(d => xScale(xValue(d)))
      .y(d => yScale(yValue(d)))
      .curve(curveBasis);
    
    let lines = chartLayer.selectAll('.line-path').data(Array.from(data.entries()))

    lines.enter().append('path')
      .attr('id', d => d[0].replace(/ /g,''))
      .attr('class', 'line-path')
      .merge(lines)
        .attr('d', d => lineGenerator(getPoints(d, props)))
        .attr('stroke', d=> colorScale(d[0]))
        lines.exit().remove()
  };

  /**
   * Display legend
   * @param {*} selection - Root SVG element
   * @param {*} props - Display data to unpack
   */
  const colorLegend = (selection, props) => {
    const {
      colorScale,
      circleRadius,
      spacing,
      textOffset
    } = props;
    let currentOpacity
  
    //Remove spaces in string
    const toId = d =>{
      return d.replace(/ /g,'')
    }

    const groups = selection.selectAll('g')
      .data(colorScale.domain());
  
    const groupsEnter = groups
      .enter().append('g')
        .attr('class', 'tick')
        //Add on click event: toggle legend text and corresponding data visibiliity
        .on("click", (event,d) => {
          currentOpacity = d3.selectAll("#" + toId(d)).style("opacity")
          d3.selectAll("#" + toId(d)).style("opacity", currentOpacity == 1 ? 0:1)
          if((currentOpacity==1)){
            dataHidden.push(d)
          }else{
            dataHidden.splice(dataHidden.indexOf(d),1)
          }
          [dataArgs.data,dataArgs.props.y] = prepData(dataArgs.data, dataHidden)
          renderGraph(dataArgs.data,dataArgs.props,dataArgs.selection,dataArgs.title)
        })
      
    groupsEnter
      .merge(groups)
        .attr('transform', (d, i) =>
          `translate(0, ${i * spacing})`
        );
    groups.exit().remove();
  
    groupsEnter.append('circle')
      .merge(groups.select('circle'))
        .attr('r', circleRadius)
        .attr('fill', colorScale);
  
    groupsEnter.append('text')
      .merge(groups.select('text'))
        .text(d => d)
        .attr('dy', '0.32em')
        .attr('x', textOffset);
  }