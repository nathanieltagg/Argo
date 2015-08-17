<div class="portlet" id="hithistogram-port"> 
  <div class="portlet-header">Hit Color</div>
  <div class="portlet-content">
    <div class="A-HitHistogram" style="height: 120px"></div>
    <select class="hit-hist-field saveable" id="hit-hist-field">
      <option value="q"     selected="selected">Charge</option>
      <option value="t"                        >Time</option>
      <option value="σq"                       >σ Charge</option>
      <option value="σt"                       >σ Time</option>
      <option value="view"                     >View</option>
      <option value="wire"                     >Wire</option>
      <option value="plane"                    >Plane</option>
      <option value="m"                        >Multiplicity</option>
    </select>
    <label><input type='checkbox' class='saveable hit-cut-max' /> Cut high</label>
    <label><input type='checkbox' class='saveable hit-cut-min' checked="checked" /> Cut low</label>
  </div>
</div>


