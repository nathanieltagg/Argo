#include "GetSloMonDB.h"
#include <iostream>
#include <curl/curl.h>

GetSlowMonDB::GetSlowMonDB(const std::string& inTime,// ="now"
                           const std::string& inChannel//="uB_TPCDrift_HV01_1_0/voltage"
                          )
    : val("{\"error\":\"Can't connect to DB\"}")
    , time(inTime)
    , channel(inChannel)
{};

GetSlowMonDB::GetSlowMonDB(double inTime, // seconds since epoch
                            const std::string& inChannel //="uB_TPCDrift_HV01_1_0/voltage"
                              )
  : val("{\"error\":\"Can't connect to DB\"}")
  , channel(inChannel)
{
  std::time_t t = inTime;
  char buf[100];
  strftime(buf,sizeof(buf),"%F %T", std::gmtime(&t));
  time = buf;
};



static size_t
WriteMemoryCallback(void *contents, size_t size, size_t nmemb, void *userp)
{
  std::string* string_ptr = (std::string*) userp;
  size_t realsize = size * nmemb;
  std::string add((char*)contents,realsize);
  string_ptr->append(add);
  return realsize;
}



void GetSlowMonDB::operator()()
{
  CURL *curl;
  CURLcode res;

  curl = curl_easy_init();
  if(curl) {

    std::string url = "http://argo-microboone.fnal.gov/server/slomoncom_proxy.cgi";
    url  += "?t=";
    url  += curl_easy_escape(curl,time.c_str(),time.length());
    url  += "&channel=";
    url  += curl_easy_escape(curl,channel.c_str(),channel.length());
    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
  
    val = "";
    /* send all data to this function  */ 
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteMemoryCallback);
 
    /* we pass our 'chunk' struct to the callback function */ 
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&val);
  
  
    /* Perform the request, res will get the return code */ 
    res = curl_easy_perform(curl);
    /* Check for errors */ 
    if(res != CURLE_OK)
       fprintf(stderr, "curl_easy_perform() failed: %s\n",
               curl_easy_strerror(res));
 
    /* always cleanup */ 
    curl_easy_cleanup(curl);
  }

}

// test with g++ GetSloMonDB.cpp -lcurl
// int main(void)
// {
//   std::string res;
//   std::cout << "go" << std::endl;
//
//   GetSlowMonDB(res);
//   std::cout << res << std::endl;
// }
