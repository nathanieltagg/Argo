#include "RootToJson.h"
#include <TH1.h>
#include <TH2.h>

JsonObject TH1ToHistogram( TH1* hist )
{
  JsonObject h;
  if(!hist) return h;
  h.add("classname",hist->ClassName());
  h.add("name",hist->GetName());
  h.add("title",hist->GetTitle());
  h.add("xlabel",hist->GetXaxis()->GetTitle());
  h.add("ylabel",hist->GetYaxis()->GetTitle());
  h.add("n",hist->GetNbinsX());
  h.add("min",JsonElement(hist->GetXaxis()->GetXmin(),9));
  h.add("max",JsonElement(hist->GetXaxis()->GetXmax(),9));
  h.add("underflow",hist->GetBinContent(0));
  h.add("overflow",hist->GetBinContent(hist->GetNbinsX()+1));
  double tot = hist->GetSumOfWeights();
  h.add("total",JsonElement(tot,5));
  h.add("sum_x",JsonElement(tot*hist->GetMean(),5));
  h.add("max_content",hist->GetMaximum());
  h.add("min_content",hist->GetMinimum());
  h.add("time_on_x",hist->GetXaxis()->GetTimeDisplay());
  JsonArray data;
  JsonArray errs;
  // Does it have errors that aren't just simple sqrt(N)?
  bool has_err = (hist->GetSumw2()->fN>0);
  for(int i=1; i <= hist->GetNbinsX();i++) {
    data.add(JsonSigFig(hist->GetBinContent(i),3));
    errs.add(JsonSigFig(hist->GetBinError(i),3));
  }
  h.add("data",data);
  if(has_err) h.add("errs",errs);
  return h;
}


JsonObject TH2ToHistogram( TH2* hist )
{
  JsonObject h;
  if(!hist) return h;
  h.add("classname",hist->ClassName());
  h.add("name",hist->GetName());
  h.add("title",hist->GetTitle());
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
  

  double tot = hist->GetSumOfWeights();
  h.add("total",tot);

  JsonArray errs;
  // Does it have errors that aren't just simple sqrt(N)?
  bool has_err = (hist->GetSumw2()->fN>0);

  JsonArray data;
  for(int i=1; i <= hist->GetNbinsX();i++) {
    JsonArray data2;
    JsonArray errs2;
    for(int j=1; j<= hist->GetNbinsY(); j++) {
      int bin = hist->GetBin(i,j);
      data2.add(JsonSigFig(hist->GetBinContent(bin),3));
      errs2.add(JsonSigFig(hist->GetBinError  (bin),3));
    }
    data.add(data2);
    errs.add(errs2);
  }
  h.add("data",data);
  if(has_err) h.add("errs",errs);
  return h;
}