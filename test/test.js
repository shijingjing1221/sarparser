/**
 * Created by jshi on 8/10/16.
 */
var fileDisplayArea;
function openFile(event) {
  var input = event.target;

  var reader = new FileReader();
  reader.onload = function(onLoadEvent){
      // fileDisplayArea.innerText = onLoadEvent.target.result;
      loadSarParser(onLoadEvent.target.result);
  };
  reader.readAsText(input.files[0]);
};

window.onload = function() {
    var fileInput = document.getElementById('fileInput');
    fileDisplayArea = document.getElementById('fileDisplayArea');
};

function loadSarParser(content){
    var parser = parsesar(content);
    var units = parser.getUnits();
    var hugepagesize = parser.getHugepageSize();
    var avg = parser.getMemAverage(),
        rows = parser.getFilteredRowForMem();

    //Calculate the static_data
    var machine_info = parser.getMachineInfo();
    var restart_info = parser.getRestartLines();

    fileDisplayArea.innerText = "parser result:\n";
    fileDisplayArea.innerText += "machine_info:\n";
    fileDisplayArea.innerText += JSON.stringify(machine_info) + "\n\n";
    fileDisplayArea.innerText += "restart_info:\n";
    fileDisplayArea.innerText += JSON.stringify(restart_info) + "\n\n";
    fileDisplayArea.innerText += "avg:\n";
    fileDisplayArea.innerText += JSON.stringify(avg) + "\n\n";
    fileDisplayArea.innerText += "rows:\n";
    fileDisplayArea.innerText += JSON.stringify(rows) + "\n\n";
};