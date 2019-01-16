#ifndef JSON_TOOLS_H_A43C798F
#define JSON_TOOLS_H_A43C798F

#include "json.hpp"
#include <string>
#include <stdio.h>

namespace jsontool 
{
  inline nlohmann::json sigfig(double value, unsigned int sig_figs=3){
    if(!std::isfinite(value)) { return nlohmann::json("nan"); }
    if(value==0) { return nlohmann::json(0); }

    // Find exponent
    int X = (int)floor(log10(value));
    unsigned int maxchar = sig_figs + 7;
    char* buff = new char[maxchar];
    if((X+1<sig_figs) ||  (X > sig_figs+4) ){
      // For most of the above cases, the %g format works well!
      snprintf(buff,maxchar,"%.*g",sig_figs,value);
    } else { // if (X <= S+2)   This rounds to an integer, which is the most efficient.
      snprintf(buff,maxchar,"%d",(int)value);
    }
    std::string s(buff);
    delete [] buff;
    return nlohmann::json(nlohmann::json::unquoted_string,s);
  }

  inline nlohmann::json fixed(double value, unsigned int precision=3){

    if(!std::isfinite(value)) { return nlohmann::json("nan"); }
    if(value==0) { return nlohmann::json(0); }

    const int maxchar = 30;
    char* buff = new char[maxchar];
    int p = snprintf(buff,maxchar,"%.*f",precision,value);
    p--;
    int dec = precision;
    while(buff[p] == '0' && dec>0) {
       dec--;
       buff[p]=0;
       p--;
    }
    if(buff[p]=='.') buff[p]=0;
    std::string s(buff);
    delete [] buff;
    return nlohmann::json(nlohmann::json::unquoted_string,s);
  }

}
  
  
#endif /* end of include guard: JSON_TOOLS_H_A43C798F */
  