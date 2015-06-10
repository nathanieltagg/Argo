#include "RootToJson.h"
#include <TH1.h>
#include <TH2.h>
#include <TDirectory.h>

#include <iostream>


int findDivisor(int n, int m)
{
  // Have m bins, want n bins.
  // Find a divisor d such that
  // nd ~ m
  // and 
  // m%d = 0.
  for(int d=2;d<100;d++) {
    if(m%d) continue;
    if(m/d >= n) continue;
    return d;
  }
  return 1;
}

JsonElement getObjectInfo( TH1* hist )
{
  JsonElement j;
  TDirectory* dir = hist->GetDirectory();
  std::string name = hist->GetName();
  name += "_Info";
  if(!dir) return j;
  TNamed* info = dynamic_cast<TNamed*>(dir->Get(name.c_str()));
  if(!info) return j;
  j.setStr(info->GetTitle());
  return j;
}

JsonObject TH1ToHistogram( TH1* inHist, int maxbins )
{
  JsonObject h;
  // Convert a histogram into a JSON file.
  h.add("name" ,inHist->GetName());
  h.add("title",inHist->GetTitle());
 
  // Rebin if requested.
  TH1* hist = inHist;
  TH1* htemp = 0;
  if(maxbins && inHist->GetNbinsX() > maxbins) {
    int rebin = findDivisor(maxbins,inHist->GetNbinsX());
    htemp = inHist->Rebin(rebin,"htemp");
    hist = htemp;
    h.add("original_n",inHist->GetNbinsX());
    h.add("rebinned_x_by",rebin);
  }
  if(!hist) return h;
  h.add("classname",hist->ClassName());
  h.add("xlabel",hist->GetXaxis()->GetTitle());
  h.add("ylabel",hist->GetYaxis()->GetTitle());
  // Custom axis labels.
  if(hist->GetXaxis()->GetLabels()) {
    JsonArray binlabels;
    for(int i=1; i <= hist->GetNbinsX();i++) {
      binlabels.add(hist->GetXaxis()->GetBinLabel(i));
    }
    h.add("binlabelsx",binlabels);
  }
  // Custom bin widths
  if(hist->GetXaxis()->IsVariableBinSize()) {
    std::cout << hist->GetName() << " has variable bins" << std::endl;
    JsonArray xbins;
    const TArrayD* Xbins = hist->GetXaxis()->GetXbins();
    for(int bin=0;bin<hist->GetNbinsX();bin++) xbins.add(Xbins->At(bin));
    h.add("x_bins",xbins);
  } else {
    std::cout << hist->GetName() << " does not have variable bins" << std::endl;
    
  }
  
  h.add("n",hist->GetNbinsX());
  h.add("min",JsonElement(hist->GetXaxis()->GetXmin(),10));
  h.add("max",JsonElement(hist->GetXaxis()->GetXmax(),10));
  h.add("underflow",hist->GetBinContent(0));
  h.add("overflow",hist->GetBinContent(hist->GetNbinsX()+1));
  double stats[11];  // TProfile and TH2 each have 7 entries, TH3 has 11. Be safe: this caused an abort trap when called incorrectly.
  hist->GetStats(stats);
  h.add("total",JsonElement(stats[0],9));
  h.add("sum_x",JsonElement(stats[2],9));
  h.add("sum_x2",JsonElement(stats[3],9));
  h.add("max_content",JsonElement(hist->GetMaximum(),4));
  h.add("min_content",JsonElement(hist->GetMinimum(),4));
  h.add("time_on_x",hist->GetXaxis()->GetTimeDisplay());
  JsonArray data;
  JsonArray errs;
  // Does it have errors that aren't just simple sqrt(N)?
  bool has_err = (hist->GetSumw2()->fN>0);
  double max_content_with_err = hist->GetMaximum();
  double min_content_with_err = hist->GetMaximum();
  for(int i=1; i <= hist->GetNbinsX();i++) {
    data.add(JsonSigFig(hist->GetBinContent(i),4));
    errs.add(JsonSigFig(hist->GetBinError(i),4));
    double ehigh = hist->GetBinContent(i)+hist->GetBinError(i);
    double elow  = hist->GetBinContent(i)-hist->GetBinError(i);
    if(ehigh> max_content_with_err) max_content_with_err = ehigh;
    if(elow < min_content_with_err) min_content_with_err = elow;
  }

  h.add("data",data);
  if(has_err) {
    h.add("errs",errs);
    h.add("min_content_with_err",JsonElement(min_content_with_err,4));
    h.add("max_content_with_err",JsonElement(max_content_with_err,4));
  }
  h.add("info",getObjectInfo(inHist));

  if(htemp) delete htemp;
  return h;
}


JsonObject TH2ToHistogram( TH2* inHist, int maxbins )
{
  JsonObject h;

  // Rebin if requested.
  TH2* hist = inHist;
  TH2* htemp = 0;
  if(maxbins && ((inHist->GetNbinsX() > maxbins) || (inHist->GetNbinsY() > maxbins))) {
    int rebinX = findDivisor(maxbins,inHist->GetNbinsX());
    int rebinY = findDivisor(maxbins,inHist->GetNbinsY());
    htemp = inHist->Rebin2D(rebinX,rebinY,"htemp");
    hist = htemp;
    h.add("original_n_x",inHist->GetNbinsX());
    h.add("original_n_y",inHist->GetNbinsY());
    h.add("rebinned_x_by",rebinX);
    h.add("rebinned_y_by",rebinY);
        
  }
  if(hist->GetXaxis()->GetLabels()) {
    JsonArray binlabels;
    for(int i=1; i <= hist->GetNbinsX();i++) {
      binlabels.add(hist->GetXaxis()->GetBinLabel(i));
    }
    h.add("binlabelsx",binlabels);
  }
  if(hist->GetYaxis()->GetLabels()) {
    JsonArray binlabels;
    for(int i=1; i <= hist->GetNbinsY();i++) {
      binlabels.add(hist->GetYaxis()->GetBinLabel(i));
    }
    h.add("binlabelsy",binlabels);
  }
 
  if(!hist) return h;
  h.add("classname",hist->ClassName());
  h.add("name" ,inHist->GetName());
  h.add("title",inHist->GetTitle());
  h.add("xlabel",hist->GetXaxis()->GetTitle());
  h.add("ylabel",hist->GetYaxis()->GetTitle());
  
  h.add("n_x",hist->GetNbinsX());
  h.add("min_x",hist->GetXaxis()->GetXmin());
  h.add("max_x",hist->GetXaxis()->GetXmax());
  h.add("n_y",hist->GetNbinsY());
  h.add("min_y",hist->GetYaxis()->GetXmin());
  h.add("max_y",hist->GetYaxis()->GetXmax());
  h.add("max_content",hist->GetMaximum());
  h.add("min_content",hist->GetMinimum());
  
  
  double stats[8];
  hist->GetStats(stats);
  h.add("total",JsonElement(stats[0],9));
  h.add("sum_x",JsonElement(stats[2],9));
  h.add("sum_x2",JsonElement(stats[3],9));
  h.add("sum_y",JsonElement(stats[6],9));
  h.add("sum_y2",JsonElement(stats[7],9));
  

  double tot = hist->GetSumOfWeights();
  h.add("total",tot);

  JsonArray errs;
  // Does it have errors that aren't just simple sqrt(N)?
  bool has_err = (hist->GetSumw2()->fN>0);

  int nx = hist->GetNbinsX();
  int ny = hist->GetNbinsY();
  JsonArray data;
  for(int i=1; i <= nx;i++) {
    JsonArray data2;
    JsonArray errs2;
    for(int j=1; j<= ny; j++) {
      int bin = hist->GetBin(i,j);
      data2.add(JsonSigFig(hist->GetBinContent(bin),3));
      errs2.add(JsonSigFig(hist->GetBinError  (bin),3));
    }
    data.add(data2);
    errs.add(errs2);
  }
  h.add("data",data);
  if(has_err) h.add("errs",errs);
  
  JsonArray underflow_x;
  JsonArray overflow_x;
  for(int j=1; j <= ny;j++)  {
    underflow_x.add(JsonSigFig(hist->GetBinContent(hist->GetBin(0,j)),3));
    overflow_x .add(JsonSigFig(hist->GetBinContent(hist->GetBin(0,nx+1)),3));
  }
  
  JsonArray overflow_y;
  JsonArray underflow_y;
  for(int i=1; i <= nx;i++)  {
    underflow_y.add(JsonSigFig(hist->GetBinContent(hist->GetBin(i,0)),3));
    overflow_y.add(JsonSigFig(hist->GetBinContent(hist->GetBin(i,ny+1)),3));
  }
  h.add("underflow_x",underflow_x);  
  h.add("overflow_x", overflow_x);  
  h.add("underflow_y",underflow_y);  
  h.add("overflow_y", overflow_y);  
  
  h.add("info",getObjectInfo(inHist));
  
  if(htemp) delete htemp;
  return h;
}
